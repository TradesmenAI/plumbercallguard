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

  const callSid = formData.get("CallSid") as string
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string
  const from = formData.get("From") as string

  if (!callSid || !recordingUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const audioUrl = `${recordingUrl}.mp3`

  // ================================
  // 1️⃣ Download recording
  // ================================
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

  // ================================
  // 2️⃣ Transcribe
  // ================================
  const transcriptResponse = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "audio.mp3"),
    model: "gpt-4o-mini-transcribe"
  })

  const transcript = transcriptResponse.text

  // ================================
  // 3️⃣ Proper caller type lookup
  // ================================
  let callerType = "unknown"

  try {
    const lookup = await twilioClient.lookups.v2
      .phoneNumbers(from)
      .fetch({ fields: "line_type_intelligence" })

    if (lookup.lineTypeIntelligence?.type) {
      callerType = lookup.lineTypeIntelligence.type
    }
  } catch (err) {
    console.log("Lookup failed:", err)
  }

  // ================================
  // 4️⃣ Clean short summary
  // ================================
  const summaryResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `
You summarise voicemail messages for tradespeople.

Rules:
- Maximum 2 sentences.
- Plain English.
- No labels.
- No formatting.
- No bullet points.
- No headings.
- Just a short natural summary of what the caller wants.
        `
      },
      {
        role: "user",
        content: transcript
      }
    ]
  })

  const aiSummary =
    summaryResponse.choices[0].message.content?.trim() || ""

  // ================================
  // 5️⃣ Save everything
  // ================================
  await supabase
    .from("calls")
    .update({
      recording_url: audioUrl,
      recording_duration: recordingDuration,
      call_status: "completed",
      transcript: transcript,
      caller_type: callerType,
      ai_summary: aiSummary
    })
    .eq("call_sid", callSid)

  return NextResponse.json({ success: true })
}