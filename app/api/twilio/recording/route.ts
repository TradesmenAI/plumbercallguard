import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import twilio from "twilio"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(req: Request) {
  const formData = await req.formData()

  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = parseInt(
    formData.get("RecordingDuration") as string
  )
  const callSid = formData.get("CallSid") as string

  if (!recordingUrl || !callSid) {
    return NextResponse.json({ ok: false })
  }

  let transcriptText = ""
  let summaryText = ""
  let callerType = "unknown"

  /* -------------------------------------------------- */
  /* GET CALLER NUMBER FROM DB                         */
  /* -------------------------------------------------- */

  const { data: callData } = await supabase
    .from("calls")
    .select("caller_number")
    .eq("call_sid", callSid)
    .single()

  const callerNumber = callData?.caller_number

  /* -------------------------------------------------- */
  /* RUN TWILIO LOOKUP                                 */
  /* -------------------------------------------------- */

  if (callerNumber) {
    try {
      const lookup = await twilioClient.lookups.v2
        .phoneNumbers(callerNumber)
        .fetch({ fields: "line_type_intelligence" })

      if (lookup.lineTypeIntelligence?.type) {
        callerType = lookup.lineTypeIntelligence.type
      }
    } catch (err) {
      console.log("Lookup failed:", err)
    }
  }

  /* -------------------------------------------------- */
  /* HANDLE SILENCE BASED ON DURATION                  */
  /* -------------------------------------------------- */

  if (!recordingDuration || recordingDuration < 2) {
    transcriptText = "No voicemail was left."
    summaryText = "Caller did not leave a voicemail."
  } else {
    try {
      /* ---------------------------------------------- */
      /* DOWNLOAD RECORDING USING TWILIO AUTH          */
      /* ---------------------------------------------- */

      const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64")

      const audioResponse = await fetch(recordingUrl + ".mp3", {
        headers: {
          Authorization: `Basic ${auth}`
        }
      })

      const audioBuffer = Buffer.from(
        await audioResponse.arrayBuffer()
      )

      /* ---------------------------------------------- */
      /* TRANSCRIBE (ENGLISH ONLY)                     */
      /* ---------------------------------------------- */

      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], "voicemail.mp3"),
        model: "whisper-1",
        language: "en"
      })

      transcriptText = transcription.text?.trim() || ""

      /* ---------------------------------------------- */
      /* GENERATE SUMMARY (ENGLISH ONLY)               */
      /* ---------------------------------------------- */

      const summary = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Summarize this voicemail in one short English sentence. Always respond in English only."
          },
          {
            role: "user",
            content: transcriptText
          }
        ],
        temperature: 0
      })

      summaryText =
        summary.choices[0].message?.content?.trim() ||
        "Voicemail received."
    } catch (err) {
      console.log("Transcription error:", err)

      transcriptText = "Voicemail received but transcription failed."
      summaryText = "Voicemail received."
    }
  }

  /* -------------------------------------------------- */
  /* SAVE EVERYTHING TO DATABASE                       */
  /* -------------------------------------------------- */

  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl + ".mp3",
      recording_duration: recordingDuration,
      ai_summary: summaryText,
      transcript: transcriptText,
      caller_type: callerType,
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ ok: true })
}