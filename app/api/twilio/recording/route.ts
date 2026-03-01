import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import twilio from "twilio"

export const runtime = "nodejs"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

function safeInt(v: any, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

function cleanName(raw: string) {
  const s = String(raw || "").trim()
  // allow letters, spaces, hyphen, apostrophe
  const cleaned = s.replace(/[^a-zA-Z\s'\-]/g, "").trim()
  // squash multiple spaces
  return cleaned.replace(/\s+/g, " ")
}

function isPlausibleName(name: string) {
  if (!name) return false
  if (name.length < 2 || name.length > 40) return false
  // avoid common junk
  const lower = name.toLowerCase()
  const banned = new Set([
    "yes",
    "no",
    "okay",
    "ok",
    "hello",
    "hi",
    "thanks",
    "thank you",
    "plumber",
    "plumbing",
    "unknown",
    "none",
  ])
  if (banned.has(lower)) return false
  // must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false
  return true
}

async function extractNameWithConfidence(transcript: string): Promise<{ name: string | null; confidence: number }> {
  const t = String(transcript || "").trim()
  if (t.length < 10) return { name: null, confidence: 0 }

  // Ask for strict JSON so parsing is safe
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Extract the caller's name ONLY if the caller explicitly states their own name (e.g., 'My name is Dan', 'This is Sarah'). " +
          "If unsure, set name to null. Return strict JSON only.",
      },
      {
        role: "user",
        content:
          "Transcript:\n" +
          t +
          "\n\nReturn JSON in this exact shape:\n" +
          '{"name": string|null, "confidence": number}\n' +
          "Confidence must be between 0 and 1.",
      },
    ],
  })

  const raw = resp.choices[0]?.message?.content?.trim() || ""
  try {
    const parsed = JSON.parse(raw) as any
    const name = parsed?.name === null ? null : cleanName(parsed?.name)
    const conf = Number(parsed?.confidence ?? 0)
    const confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0
    if (!name) return { name: null, confidence }
    if (!isPlausibleName(name)) return { name: null, confidence: 0 }
    return { name, confidence }
  } catch {
    return { name: null, confidence: 0 }
  }
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const recordingUrl = String(formData.get("RecordingUrl") || "")
  const recordingDuration = safeInt(formData.get("RecordingDuration"), 0)
  const callSid = String(formData.get("CallSid") || "")

  if (!recordingUrl || !callSid) return NextResponse.json({ ok: false })

  // Pull call row so we have caller_number, inbound_to, sms_sent (idempotency)
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

  // Lookup caller type (mobile/landline)
  if (callerNumber) {
    try {
      const lookup = await twilioClient.lookups.v2.phoneNumbers(callerNumber).fetch({
        fields: "line_type_intelligence",
      })
      const t = (lookup as any)?.lineTypeIntelligence?.type
      if (t) callerType = t
    } catch (err) {
      console.log("Lookup failed:", err)
    }
  }

  // Keep your rule: duration < 2 seconds = no voicemail
  if (!recordingDuration || recordingDuration < 2) {
    transcriptText = "No voicemail was left."
    summaryText = "Caller did not leave a voicemail."
  } else {
    try {
      // Download recording using Twilio auth
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")
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

      // Summary: faithful, short, no invented details
      const summary = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Summarize the voicemail in one short sentence. Be faithful to the transcript. Do not invent details.",
          },
          { role: "user", content: transcriptText || "Voicemail received." },
        ],
        temperature: 0,
      })

      summaryText = summary.choices[0].message?.content?.trim() || "Voicemail received."
    } catch (err) {
      console.log("Transcription error:", err)
      transcriptText = "Voicemail received but transcription failed."
      summaryText = "Voicemail received."
    }
  }

  // NEW: name extraction (only when confident)
  // You asked for "if confident" — we’ll use 0.85 threshold.
  let callerName: string | null = null
  let nameSource: "ai" | null = null
  let nameConfidence: number | null = null

  if (recordingDuration >= 2 && transcriptText && transcriptText !== "No voicemail was left.") {
    const extracted = await extractNameWithConfidence(transcriptText)
    if (extracted.name && extracted.confidence >= 0.85) {
      callerName = extracted.name
      nameSource = "ai"
      nameConfidence = extracted.confidence
    }
  }

  // Save voicemail + name data
  await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl + ".mp3",
      recording_duration: recordingDuration,
      ai_summary: summaryText,
      transcript: transcriptText,
      caller_type: callerType,
      call_status: "completed",

      // NEW name fields (safe even if columns were just added)
      caller_name: callerName,
      name_source: nameSource,
      name_confidence: nameConfidence,
    })
    .eq("call_sid", callSid)

  // Existing behaviour: send SMS if voicemail >= 2 seconds + mobile + not already sent
  const shouldSendSms =
    !alreadySmsSent &&
    recordingDuration >= 2 &&
    String(callerType).toLowerCase() === "mobile" &&
    !!callerNumber

  if (shouldSendSms) {
    try {
      const msg = "Sorry we missed your call — we’ve got your voicemail and will get back to you as soon as possible."

      await twilioClient.messages.create({
        from: inboundTo || process.env.TWILIO_FROM_NUMBER,
        to: callerNumber,
        body: msg,
      })

      await supabase.from("calls").update({ sms_sent: true }).eq("call_sid", callSid)
    } catch (err) {
      console.log("SMS send failed:", err)
    }
  }

  return NextResponse.json({ ok: true })
}