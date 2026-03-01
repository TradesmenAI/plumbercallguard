import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import twilio from "twilio"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

function safeInt(v: any, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const recordingUrl = String(formData.get("RecordingUrl") || "")
  const recordingDuration = safeInt(formData.get("RecordingDuration"), 0)
  const callSid = String(formData.get("CallSid") || "")

  if (!recordingUrl || !callSid) return NextResponse.json({ ok: false })

  // Pull the call row so we have caller number, inbound_to, user_id, and current sms_sent
  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .select("caller_number,inbound_to,user_id,sms_sent")
    .eq("call_sid", callSid)
    .single()

  if (callErr || !callRow) {
    return NextResponse.json({ ok: false, error: "Call row not found" }, { status: 404 })
  }

  const callerNumber = String((callRow as any).caller_number || "")
  const inboundTo = String((callRow as any).inbound_to || "")
  const alreadySmsSent = (callRow as any).sms_sent === true

  let transcriptText = ""
  let summaryText = ""
  let callerType = "unknown"

  // Twilio lookup (mobile/landline)
  if (callerNumber) {
    try {
      const lookup = await twilioClient.lookups.v2
        .phoneNumbers(callerNumber)
        .fetch({ fields: "line_type_intelligence" })

      const t = (lookup as any)?.lineTypeIntelligence?.type
      if (t) callerType = t
    } catch (err) {
      console.log("Lookup failed:", err)
    }
  }

  // If duration < 2s, treat as no voicemail (keep your rule)
  if (!recordingDuration || recordingDuration < 2) {
    transcriptText = "No voicemail was left."
    summaryText = "Caller did not leave a voicemail."
  } else {
    try {
      // Download recording using Twilio auth
      const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64")

      const audioResponse = await fetch(recordingUrl + ".mp3", {
        headers: { Authorization: `Basic ${auth}` },
      })

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      // Transcribe
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], "voicemail.mp3"),
        model: "whisper-1",
        language: "en",
      })

      transcriptText = (transcription.text || "").trim()

      // Summarise
      const summary = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Summarize this voicemail in one short English sentence. Always respond in English only.",
          },
          { role: "user", content: transcriptText || "Voicemail received." },
        ],
        temperature: 0,
      })

      summaryText =
        summary.choices[0].message?.content?.trim() || "Voicemail received."
    } catch (err) {
      console.log("Transcription error:", err)
      transcriptText = "Voicemail received but transcription failed."
      summaryText = "Voicemail received."
    }
  }

  // Save voicemail data first
  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl + ".mp3",
      recording_duration: recordingDuration,
      ai_summary: summaryText,
      transcript: transcriptText,
      caller_type: callerType,
      call_status: "completed",
    })
    .eq("call_sid", callSid)

  // Send SMS (mobile only, voicemail only, once)
  const shouldSendSms =
    !alreadySmsSent &&
    recordingDuration >= 2 &&
    String(callerType).toLowerCase() === "mobile" &&
    !!callerNumber

  if (shouldSendSms) {
    try {
      const msg =
        "Sorry we missed your call — we’ve got your voicemail and will get back to you as soon as possible."

      await twilioClient.messages.create({
        from: inboundTo || process.env.TWILIO_FROM_NUMBER,
        to: callerNumber,
        body: msg,
      })

      await supabase.from("calls").update({ sms_sent: true }).eq("call_sid", callSid)
    } catch (err) {
      console.log("SMS send failed:", err)
      // don’t throw – voicemail is still saved
    }
  }

  return NextResponse.json({ ok: true })
}