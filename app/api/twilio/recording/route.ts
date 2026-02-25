import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Twilio from "twilio"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilio = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

async function waitForTranscription(recordingSid: string) {
  for (let i = 0; i < 10; i++) {
    const transcriptions = await twilio
      .recordings(recordingSid)
      .transcriptions
      .list({ limit: 1 })

    if (transcriptions.length > 0) {
      return transcriptions[0].transcriptionText
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return null
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const recordingSid = formData.get("RecordingSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string

  if (!callSid || !recordingSid) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl,
      recording_duration: recordingDuration,
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  const transcript = await waitForTranscription(recordingSid)

  if (transcript) {
    await supabase
      .from("calls")
      .update({ transcript })
      .eq("call_sid", callSid)
  }

  return NextResponse.json({ success: true })
}