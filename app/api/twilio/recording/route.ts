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
  const transcriptionText =
    (formData.get("TranscriptionText") as string) || null

  let summary: string | null = null

  if (transcriptionText) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Summarise this customer call for a plumber. Extract: customer name, problem, urgency, location, and key details."
        },
        {
          role: "user",
          content: transcriptionText
        }
      ]
    })

    summary = completion.choices[0].message.content || null
  }

  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl,
      recording_duration: Number(recordingDuration),
      call_status: "completed",
      transcript: transcriptionText,
      ai_summary: summary
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}