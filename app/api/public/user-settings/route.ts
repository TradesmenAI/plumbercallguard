import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseBusinessHours(value: any) {
  // sometimes stored as jsonb object, sometimes as stringified json depending on UI
  if (!value) return null
  if (typeof value === "object") return value
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
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

  const { data: user, error } = await supabase
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

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (String(user.voicemail_token) !== String(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const business_hours = parseBusinessHours((user as any).business_hours)

  return NextResponse.json({
    data: {
      ...user,
      business_hours,
    },
  })
}