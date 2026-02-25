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

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string

  if (!callSid) {
    return NextResponse.json({ error: "Missing CallSid" }, { status: 400 })
  }

  // Update recording info
  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl,
      recording_duration: recordingDuration,
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  // Wait 3 seconds for transcription to be ready
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Fetch transcription from Twilio API
  const transcriptions = await twilio.transcriptions.list({
    callSid: callSid,
    limit: 1
  })

  if (transcriptions.length > 0) {
    await supabase
      .from("calls")
      .update({
        transcript: transcriptions[0].transcriptionText
      })
      .eq("call_sid", callSid)
  }

  return NextResponse.json({ success: true })
}