import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminKey } from "../_guard"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type UserRow = {
  id: string
  email: string
  full_name: string | null
  business_name: string | null
  plan: string
  timezone: string | null
  business_hours: any
  tts_voice_gender: "male" | "female" | null

  voicemail_token: string

  voicemail_in_mode: "tts" | "audio" | null
  voicemail_in_tts: string | null
  voicemail_in_audio_path: string | null

  voicemail_out_mode: "tts" | "audio" | null
  voicemail_out_tts: string | null
  voicemail_out_audio_path: string | null
}

function parseBusinessHours(v: any) {
  if (!v) return null
  if (typeof v === "string") {
    try {
      return JSON.parse(v)
    } catch {
      return null
    }
  }
  return v
}

export async function GET(req: NextRequest) {
  // NEW: admin header required
  const guard = requireAdminKey(req)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const token = searchParams.get("token")

  if (!userId || !token) {
    return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  }

  const { data, error } = await admin
    .from("users")
    .select(
      [
        "id",
        "email",
        "full_name",
        "business_name",
        "plan",
        "timezone",
        "business_hours",
        "tts_voice_gender",
        "voicemail_token",
        "voicemail_in_mode",
        "voicemail_in_tts",
        "voicemail_in_audio_path",
        "voicemail_out_mode",
        "voicemail_out_tts",
        "voicemail_out_audio_path",
      ].join(",")
    )
    .eq("id", userId)
    .single()

  if (error || !data) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const user = data as unknown as UserRow

  if (String(user.voicemail_token) !== String(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    data: {
      ...user,
      business_hours: parseBusinessHours(user.business_hours),
    },
  })
}