import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string

  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl,
      recording_duration: Number(recordingDuration),
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}