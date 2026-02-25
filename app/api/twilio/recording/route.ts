import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import twilio from "twilio"
import OpenAI from "openai"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(req: Request) {
  const formData = await req.formData()

  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string
  const callSid = formData.get("CallSid") as string

  if (!recordingUrl || !callSid) {
    return NextResponse.json({ ok: false })
  }

  /* -------------------------------------------------- */
  /* GET CALLER NUMBER                                 */
  /* -------------------------------------------------- */

  const { data: callData } = await supabase
    .from("calls")
    .select("caller_number")
    .eq("call_sid", callSid)
    .single()

  const callerNumber = callData?.caller_number
  let callerType = "unknown"

  /* -------------------------------------------------- */
  /* TWILIO LOOKUP                                     */
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
      console.log("Lookup failed")
    }
  }

  /* -------------------------------------------------- */
  /* DOWNLOAD AUDIO                                    */
  /* -------------------------------------------------- */

  const audioUrl = recordingUrl + ".mp3"

  const audioResponse = await fetch(audioUrl, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64"),
    },
  })

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

  /* -------------------------------------------------- */
  /* TRANSCRIBE WITH OPENAI                            */
  /* -------------------------------------------------- */

  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "voicemail.mp3"),
    model: "gpt-4o-transcribe",
  })

  const transcriptText = transcription.text

  /* -------------------------------------------------- */
  /* GENERATE SHORT SUMMARY                            */
  /* -------------------------------------------------- */

  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You summarize voicemails in 1–2 short sentences. Be concise. Do not add extra analysis. Just clearly state what the caller wants.",
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],
    temperature: 0.2,
  })

  const summaryText =
    summaryResponse.choices[0]?.message?.content?.trim() ?? null

  /* -------------------------------------------------- */
  /* SAVE EVERYTHING                                   */
  /* -------------------------------------------------- */

  await supabase
    .from("calls")
    .update({
      recording_url: audioUrl,
      recording_duration: recordingDuration,
      transcript: transcriptText,
      ai_summary: summaryText,
      caller_type: callerType,
      call_status: "completed",
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ ok: true })
}