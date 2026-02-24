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

  const fullRecordingUrl = `${recordingUrl}.mp3`

  // Simple placeholder summary (we will upgrade this later)
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: "Summarise this call in 2 short professional sentences."
      }
    ]
  })

  const summary = completion.choices[0].message.content

  await supabase
    .from("calls")
    .update({
      recording_url: fullRecordingUrl,
      recording_duration: parseInt(recordingDuration),
      call_status: "completed",
      ai_summary: summary
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}