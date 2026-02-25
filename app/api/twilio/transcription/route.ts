import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const transcriptionText = formData.get("TranscriptionText") as string

  await supabase
    .from("calls")
    .update({
      transcript: transcriptionText
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}