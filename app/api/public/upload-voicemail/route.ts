import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const form = await req.formData()
  const userId = form.get("userId") as string | null
  const token = form.get("token") as string | null
  const typeRaw = (form.get("type") as string | null) ?? "in"
  const type: "in" | "out" = typeRaw === "out" ? "out" : "in"
  const file = form.get("file") as File | null

  if (!userId || !token) return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

  const { data: user, error } = await supabase
    .from("users")
    .select("id, plan, voicemail_token")
    .eq("id", userId)
    .single()

  if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (String(user.voicemail_token) !== String(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const plan = String(user.plan || "standard").toLowerCase()
  const isPro = plan === "pro"
  if (type === "out" && !isPro) {
    return NextResponse.json({ error: "Out-of-hours MP3 is Pro only" }, { status: 403 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `${userId}/${type === "out" ? "out-of-hours" : "in-hours"}.mp3`

  const { error: uploadErr } = await supabase.storage.from("voicemails").upload(objectPath, buffer, {
    contentType: file.type || "audio/mpeg",
    upsert: true,
  })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // Update new + legacy columns for compatibility
  const payload: Record<string, any> = {}
  if (type === "in") {
    payload.voicemail_in_mode = "audio"
    payload.voicemail_in_audio_path = objectPath
    payload.voicemail_type = "audio"
    payload.voicemail_audio_path = objectPath
  } else {
    payload.voicemail_out_mode = "audio"
    payload.voicemail_out_audio_path = objectPath
    payload.ooh_voicemail_type = "audio"
    payload.ooh_voicemail_audio_path = objectPath
  }

  const { error: updErr } = await supabase.from("users").update(payload).eq("id", userId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true, path: objectPath })
}