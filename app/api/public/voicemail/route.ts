import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as any
  const userId = body?.userId as string | undefined
  const token = body?.token as string | undefined
  const gender = String(body?.tts_voice_gender || "").toLowerCase()

  if (!userId || !token) return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  if (gender !== "male" && gender !== "female") {
    return NextResponse.json({ error: "tts_voice_gender must be 'male' or 'female'" }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, voicemail_token")
    .eq("id", userId)
    .single()

  if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (String(user.voicemail_token) !== String(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error: updErr } = await supabase.from("users").update({ tts_voice_gender: gender }).eq("id", userId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}