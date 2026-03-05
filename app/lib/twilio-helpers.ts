import { twiml as TwilioTwiml } from "twilio"
import { publicBaseUrl } from "@/app/lib/publicBaseUrl"

type VoiceResponse = InstanceType<typeof TwilioTwiml.VoiceResponse>

/**
 * Classify a caller number without any API call using UK E.164 prefix rules.
 *
 * Rules:
 *  +447…  → mobile   (UK mobile numbers starting with 07)
 *  +441…  → landline (UK geographic 01xxx)
 *  +442…  → landline (UK geographic 02xxx)
 *  +443…  → landline (UK non-geographic 03xxx, landline-rate)
 *  "anonymous" / "private" / empty → withheld
 *  anything else → unknown
 */
export function classifyCallerType(raw: string): "mobile" | "landline" | "withheld" | "unknown" {
  const s = String(raw ?? "").trim()
  const lower = s.toLowerCase()
  if (!s || lower === "anonymous" || lower === "private") return "withheld"
  const e164 = s.replace(/[^\d+]/g, "")
  if (!e164) return "withheld"
  if (/^\+447/.test(e164)) return "mobile"
  if (/^\+44[123]/.test(e164)) return "landline"
  return "unknown"
}

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export function weekdayKey(shortName: string): DayKey {
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

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10))
  return h * 60 + m
}

export function getLocalParts(timeZone: string) {
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

export function isOpenNowFromBusinessHours(user: Record<string, unknown>): boolean {
  const tz = String(user.timezone || "Europe/London")
  const hours = user.business_hours || null
  if (!hours || typeof hours !== "object") return false
  const { weekday, hhmm } = getLocalParts(tz)
  const key = weekdayKey(weekday)
  const dayCfg = (hours as Record<string, unknown>)[key] as Record<string, unknown> | undefined
  if (!dayCfg || dayCfg.enabled !== true) return false
  const start = String(dayCfg.start || "09:00")
  const end = String(dayCfg.end || "17:00")
  const nowM = timeToMinutes(hhmm)
  const startM = timeToMinutes(start)
  const endM = timeToMinutes(end)
  return nowM >= startM && nowM < endM
}

export function isOpenNowLegacyOOH(user: Record<string, unknown>): boolean {
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

export function getPollyNeuralVoiceForGender(gender: string | null | undefined) {
  const g = String(gender || "female").toLowerCase()
  return g === "male" ? "Polly.Brian-Neural" : "Polly.Emma-Neural"
}

function buildVoicemailStreamUrl(userId: string, type: "in" | "out", token: string) {
  const base = publicBaseUrl()
  return `${base}/api/voicemail/${userId}/${type}?token=${encodeURIComponent(token)}`
}

const DEFAULT_IN_HOURS_MSG =
  "Thank you for calling XYZ Plumbing.\nPlease leave a message and we will get back to you as soon as possible."
const DEFAULT_OUT_OF_HOURS_MSG =
  "Thank you for calling XYZ Plumbing. We are currently closed.\nPlease leave a message and we will get back to you as soon as we open."

export function appendVoicemailTwiml(
  response: VoiceResponse,
  user: Record<string, unknown>,
  cfgType: "in" | "out"
) {
  const base = publicBaseUrl()
  const token = String(user.voicemail_token || "")
  const newMode = cfgType === "out" ? user.voicemail_out_mode : user.voicemail_in_mode
  const newTts = cfgType === "out" ? user.voicemail_out_tts : user.voicemail_in_tts
  const newAudioPath = cfgType === "out" ? user.voicemail_out_audio_path : user.voicemail_in_audio_path
  const legacyMode = cfgType === "out" ? user.ooh_voicemail_type : user.voicemail_type
  const legacyTts = cfgType === "out" ? user.ooh_voicemail_message : user.voicemail_message
  const legacyAudioPath = cfgType === "out" ? user.ooh_voicemail_audio_path : user.voicemail_audio_path

  const mode = String(newMode || legacyMode || "tts").toLowerCase()
  const ttsText = String(newTts || legacyTts || "").trim()
  const audioPath = String(newAudioPath || legacyAudioPath || "").trim()

  const canPlayAudio =
    mode === "audio" &&
    !!audioPath &&
    !!token &&
    !!process.env.BASE_URL &&
    process.env.BASE_URL.startsWith("http")

  if (canPlayAudio) {
    const audioUrl = buildVoicemailStreamUrl(String(user.id), cfgType, token)
    response.play(audioUrl)
  } else {
    const msg =
      cfgType === "out"
        ? ttsText || DEFAULT_OUT_OF_HOURS_MSG
        : ttsText || DEFAULT_IN_HOURS_MSG
    const voice = getPollyNeuralVoiceForGender(user.tts_voice_gender as string | null)
    response.say({ voice, language: "en-GB" }, msg)
  }

  response.record({
    maxLength: 60,
    timeout: 5,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: `${base}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  })
  response.hangup()
}
