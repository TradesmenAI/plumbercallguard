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
  const recordingDuration = formData.get("RecordingDuration") as string
  const callSid = formData.get("CallSid") as string

  if (!recordingUrl || !callSid) {
    return NextResponse.json({ ok: false })
  }

  /* -------------------------------------------------- */
  /* TRANSCRIBE WITH ENGLISH ONLY                      */
  /* -------------------------------------------------- */

  let transcriptText = ""
  let summaryText = ""

  try {
    const response = await openai.audio.transcriptions.create({
      file: await fetch(recordingUrl + ".mp3").then(r => r.blob()),
      model: "whisper-1",
      language: "en" // 🔥 FORCE ENGLISH ONLY
    })

    transcriptText = response.text?.trim() || ""

  } catch (err) {
    console.log("Transcription error:", err)
  }

  /* -------------------------------------------------- */
  /* HANDLE SILENCE / BAD SIGNAL                       */
  /* -------------------------------------------------- */

  if (!transcriptText || transcriptText.length < 5) {
    transcriptText = "No voicemail was left."
    summaryText = "Caller did not leave a voicemail."
  } else {
    /* ---------------------------------------------- */
    /* GENERATE SUMMARY (ENGLISH ONLY)               */
    /* ---------------------------------------------- */

    try {
      const summary = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that summarizes voicemails. Always respond in English only. Provide a short 1 sentence summary."
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
      console.log("Summary error:", err)
      summaryText = "Voicemail received."
    }
  }

  /* -------------------------------------------------- */
  /* SAVE TO DATABASE                                  */
  /* -------------------------------------------------- */

  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl + ".mp3",
      recording_duration: recordingDuration,
      ai_summary: summaryText,
      transcript: transcriptText,
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ ok: true })
}