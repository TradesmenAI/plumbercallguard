import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminKey } from "../../_guard"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const guard = requireAdminKey(req)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const body = await req.json()

    const userId = String(body.userId || "")
    const token = String(body.token || "")
    const type = String(body.type || "in") // "in" | "out"

    if (!userId || !token) {
      return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
    }

    const { data: user, error: uerr } = await admin
      .from("users")
      .select("id, plan, voicemail_token")
      .eq("id", userId)
      .single()

    if (uerr || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (String(user.voicemail_token) !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Pro-only guard for "out"
    if (type === "out" && String(user.plan).toLowerCase() !== "pro") {
      return NextResponse.json({ error: "Pro required for out-of-hours" }, { status: 403 })
    }

    const patch: any = {}

    // voice gender
    if (body.tts_voice_gender === "male" || body.tts_voice_gender === "female") {
      patch.tts_voice_gender = body.tts_voice_gender
    }

    // in-hours
    if (type === "in") {
      if (body.mode === "tts" || body.mode === "audio") patch.voicemail_in_mode = body.mode
      if (typeof body.ttsText === "string") patch.voicemail_in_tts = body.ttsText
    }

    // out-of-hours
    if (type === "out") {
      if (body.mode === "tts" || body.mode === "audio") patch.voicemail_out_mode = body.mode
      if (typeof body.ttsText === "string") patch.voicemail_out_tts = body.ttsText
    }

    const { error: perr } = await admin.from("users").update(patch).eq("id", userId)
    if (perr) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad request" }, { status: 400 })
  }
}