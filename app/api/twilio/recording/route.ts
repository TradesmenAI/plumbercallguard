import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string

  if (!callSid || !recordingUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Twilio recording requires .mp3 extension
  const audioUrl = `${recordingUrl}.mp3`

  // Download audio
  const audioResponse = await fetch(audioUrl, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64")
    }
  })

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

  // Send to OpenAI Whisper
  const transcriptResponse = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "audio.mp3"),
    model: "gpt-4o-mini-transcribe"
  })

  const transcript = transcriptResponse.text

  // Save recording + transcript
  await supabase
    .from("calls")
    .update({
      recording_url: audioUrl,
      recording_duration: recordingDuration,
      call_status: "completed",
      transcript: transcript
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}