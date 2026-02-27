import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

function weekdayKey(shortName: string): DayKey {
  const map: Record<string, DayKey> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  }
  return map[shortName] ?? "mon"
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10))
  return h * 60 + m
}

function getLocalParts(timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = dtf.formatToParts(new Date())
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  return { weekday, hhmm: `${hour}:${minute}` }
}

function isOpenNowFromBusinessHours(user: any): boolean {
  const tz = String(user.timezone || "Europe/London")
  const hours = user.business_hours || null
  if (!hours || typeof hours !== "object") return false

  const { weekday, hhmm } = getLocalParts(tz)
  const key = weekdayKey(weekday)

  const dayCfg = hours[key]
  if (!dayCfg || dayCfg.enabled !== true) return false

  const start = String(dayCfg.start || "09:00")
  const end = String(dayCfg.end || "17:00")

  const nowM = timeToMinutes(hhmm)
  const startM = timeToMinutes(start)
  const endM = timeToMinutes(end)

  return nowM >= startM && nowM < endM
}

function isOpenNowLegacyOOH(user: any): boolean {
  const enabled = user.ooh_enabled === true
  if (!enabled) return true

  const startRaw = String(user.ooh_start || "09:00:00").slice(0, 5)
  const endRaw = String(user.ooh_end || "17:00:00").slice(0, 5)

  const tz = String(user.timezone || "Europe/London")
  const { hhmm } = getLocalParts(tz)

  const nowM = timeToMinutes(hhmm)
  const startM = timeToMinutes(startRaw)
  const endM = timeToMinutes(endRaw)

  if (startM < endM) return nowM >= startM && nowM < endM
  return nowM >= startM || nowM < endM
}

function buildVoicemailStreamUrl(userId: string, type: "in" | "out", token: string) {
  const base = process.env.BASE_URL
  return `${base}/api/voicemail/${userId}/${type}?token=${encodeURIComponent(token)}`
}

function getPollyNeuralVoiceForGender(gender: string | null | undefined) {
  // female -> Emma Neural, male -> Brian Neural
  const g = String(gender || "female").toLowerCase()
  return g === "male" ? "Polly.Brian-Neural" : "Polly.Emma-Neural"
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const from = formData.get("From") as string
  const to = formData.get("To") as string

  if (!callSid || !from || !to) {
    return new NextResponse("Missing data", { status: 400 })
  }

  const { data: user } = await supabase.from("users").select("*").eq("twilio_number", to).single()

  if (!user) {
    return new NextResponse("User not found", { status: 404 })
  }

  // Keep existing feature: store the call row
  await supabase.from("calls").upsert(
    {
      call_sid: callSid,
      caller_number: from,
      user_id: user.id,
      call_status: "incoming",
    },
    { onConflict: "call_sid" }
  )

  const plan = String(user.plan || "standard").toLowerCase()
  const isPro = plan === "pro"

  const openNow = user.business_hours ? isOpenNowFromBusinessHours(user) : isOpenNowLegacyOOH(user)
  const cfgType: "in" | "out" = isPro ? (openNow ? "in" : "out") : "in"

  // Defaults (do not remove)
  const defaultInHoursMessage =
    "Thank you for calling XYZ Plumbing.\nPlease leave a message and we will get back to you as soon as possible."
  const defaultOutOfHoursMessage =
    "Thank you for calling XYZ Plumbing. We are currently closed.\nPlease leave a message and we will get back to you as soon as we open."

  const token = String(user.voicemail_token || "")

  // Prefer new columns, fall back to legacy columns
  const newMode = cfgType === "out" ? user.voicemail_out_mode : user.voicemail_in_mode
  const newTts = cfgType === "out" ? user.voicemail_out_tts : user.voicemail_in_tts
  const newAudioPath = cfgType === "out" ? user.voicemail_out_audio_path : user.voicemail_in_audio_path

  const legacyMode = cfgType === "out" ? user.ooh_voicemail_type : user.voicemail_type
  const legacyTts = cfgType === "out" ? user.ooh_voicemail_message : user.voicemail_message
  const legacyAudioPath = cfgType === "out" ? user.ooh_voicemail_audio_path : user.voicemail_audio_path

  const mode = String(newMode || legacyMode || "tts").toLowerCase()
  const ttsText = String(newTts || legacyTts || "").trim()
  const audioPath = String(newAudioPath || legacyAudioPath || "").trim()

  const response = new twiml.VoiceResponse()

  const canPlayAudio =
    mode === "audio" && !!audioPath && !!token && !!process.env.BASE_URL && process.env.BASE_URL.startsWith("http")

  if (canPlayAudio) {
    const audioUrl = buildVoicemailStreamUrl(user.id, cfgType, token)
    response.play(audioUrl)
  } else {
    const fallbackMsg =
      cfgType === "out"
        ? (ttsText || defaultOutOfHoursMessage)
        : (ttsText || defaultInHoursMessage)

    // NEW: use Emma/Brian Neural based on tts_voice_gender
    const voice = getPollyNeuralVoiceForGender(user.tts_voice_gender)
    response.say({ voice, language: "en-GB" }, fallbackMsg)
  }

  // Keep existing feature: record voicemail and callback
  response.record({
    maxLength: 60,
    timeout: 5,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  })

  response.hangup()

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  })
}