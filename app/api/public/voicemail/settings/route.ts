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
  const type = body?.type === "out" ? "out" : "in"
  const mode = body?.mode === "audio" ? "audio" : "tts"
  const ttsText = typeof body?.ttsText === "string" ? body.ttsText.trim() : ""

  if (!userId || !token) return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  if (mode === "tts" && !ttsText) return NextResponse.json({ error: "ttsText is required when mode=tts" }, { status: 400 })

  const { data: user, error } = await supabase
    .from("users")
    .select("id, plan, voicemail_token")
    .eq("id", userId)
    .single()

  if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (String(user.voicemail_token) !== String(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Out-of-hours settings are allowed to be saved for everyone, but only Pro switching will actually use them.
  const payload: Record<string, any> = {}

  if (type === "in") {
    // New
    payload.voicemail_in_mode = mode
    payload.voicemail_in_tts = mode === "tts" ? ttsText : null
    // Legacy
    payload.voicemail_type = mode
    if (mode === "tts") payload.voicemail_message = ttsText
  } else {
    // New
    payload.voicemail_out_mode = mode
    payload.voicemail_out_tts = mode === "tts" ? ttsText : null
    // Legacy
    payload.ooh_voicemail_type = mode
    if (mode === "tts") payload.ooh_voicemail_message = ttsText
  }

  const { error: updErr } = await supabase.from("users").update(payload).eq("id", userId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}