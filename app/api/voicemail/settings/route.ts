import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST JSON:
 * {
 *   "type": "in" | "out",
 *   "mode": "tts" | "audio",
 *   "ttsText": "string" (required if mode = "tts")
 * }
 *
 * Auth: Authorization: Bearer <supabase_access_token>
 *
 * Pro-only for type="out"
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (!bearer) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

  const { data: authData, error: authErr } = await supabase.auth.getUser(bearer)
  if (authErr || !authData?.user?.id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const userId = authData.user.id
  const body = (await req.json().catch(() => null)) as any

  const type: "in" | "out" = body?.type === "out" ? "out" : "in"
  const mode: "tts" | "audio" = body?.mode === "audio" ? "audio" : "tts"
  const ttsText = String(body?.ttsText ?? "").trim()

  const { data: userRow } = await supabase.from("users").select("plan").eq("id", userId).single()
  const plan = String(userRow?.plan || "standard").toLowerCase()
  const isPro = plan === "pro"

  if (type === "out" && !isPro) {
    return NextResponse.json({ error: "Out-of-hours settings are Pro only" }, { status: 403 })
  }

  if (mode === "tts" && !ttsText) {
    return NextResponse.json({ error: "ttsText is required for TTS mode" }, { status: 400 })
  }

  const payload: Record<string, any> = {}

  if (type === "in") {
    // New
    payload.voicemail_in_mode = mode
    payload.voicemail_in_tts = mode === "tts" ? ttsText : null
    // Legacy
    payload.voicemail_type = mode
    payload.voicemail_message = mode === "tts" ? ttsText : payload.voicemail_message
  } else {
    // New
    payload.voicemail_out_mode = mode
    payload.voicemail_out_tts = mode === "tts" ? ttsText : null
    // Legacy
    payload.ooh_voicemail_type = mode
    payload.ooh_voicemail_message = mode === "tts" ? ttsText : payload.ooh_voicemail_message
  }

  const { error } = await supabase.from("users").update(payload).eq("id", userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}