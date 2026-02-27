import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
type HoursCfg = { enabled: boolean; start: string; end: string }
type BusinessHours = Record<DayKey, HoursCfg>

type UserRow = {
  id: string
  plan: string | null
  timezone: string | null
  business_hours: any
  tts_voice_gender: string | null
  voicemail_in_mode: string | null
  voicemail_in_tts: string | null
  voicemail_in_audio_path: string | null
  voicemail_out_mode: string | null
  voicemail_out_tts: string | null
  voicemail_out_audio_path: string | null
  voicemail_token: string | null
}

function parseBusinessHours(value: any): BusinessHours | null {
  if (!value) return null
  if (typeof value === "object") return value as BusinessHours
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as BusinessHours
    } catch {
      return null
    }
  }
  return null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get("userId")
  const token = url.searchParams.get("token")

  if (!userId || !token) {
    return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      [
        "id",
        "plan",
        "timezone",
        "business_hours",
        "tts_voice_gender",
        "voicemail_in_mode",
        "voicemail_in_tts",
        "voicemail_in_audio_path",
        "voicemail_out_mode",
        "voicemail_out_tts",
        "voicemail_out_audio_path",
        "voicemail_token",
      ].join(",")
    )
    .eq("id", userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Safe cast after null-check (avoids GenericStringError typing in Next build)
  const user = data as unknown as UserRow

  if (String(user.voicemail_token) !== String(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const business_hours = parseBusinessHours(user.business_hours)

  return NextResponse.json({
    data: {
      id: user.id,
      plan: user.plan ?? "standard",
      timezone: user.timezone ?? "Europe/London",
      business_hours,
      tts_voice_gender: (user.tts_voice_gender ?? "female") as "male" | "female",
      voicemail_in_mode: (user.voicemail_in_mode ?? "tts") as "tts" | "audio",
      voicemail_in_tts: user.voicemail_in_tts,
      voicemail_in_audio_path: user.voicemail_in_audio_path,
      voicemail_out_mode: (user.voicemail_out_mode ?? "tts") as "tts" | "audio",
      voicemail_out_tts: user.voicemail_out_tts,
      voicemail_out_audio_path: user.voicemail_out_audio_path,
    },
  })
}