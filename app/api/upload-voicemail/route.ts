import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST form-data:
 * - file: File (mp3/wav/m4a)
 * - type: "in" | "out"  (optional; default "in")
 *
 * Auth:
 * - Authorization: Bearer <supabase_access_token>
 *
 * Notes:
 * - Out-of-hours ("out") upload is Pro-only.
 * - Stores audio in bucket "voicemails" at:
 *   {userId}/in-hours.mp3 OR {userId}/out-of-hours.mp3
 * - Updates BOTH:
 *   New columns: voicemail_in/out_mode + voicemail_in/out_audio_path
 *   Legacy columns: voicemail_type/voicemail_audio_path and ooh_voicemail_type/ooh_voicemail_audio_path
 */
export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const typeRaw = (formData.get("type") as string | null) ?? "in"
  const type: "in" | "out" = typeRaw === "out" ? "out" : "in"

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (!bearer) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser(bearer)
  if (authErr || !authData?.user?.id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const userId = authData.user.id

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, plan")
    .eq("id", userId)
    .single()

  if (userErr || !userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const plan = String(userRow.plan || "standard").toLowerCase()
  const isPro = plan === "pro"

  if (type === "out" && !isPro) {
    return NextResponse.json({ error: "Out-of-hours voicemail is Pro only" }, { status: 403 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const objectPath = `${userId}/${type === "out" ? "out-of-hours" : "in-hours"}.mp3`

  const { error: uploadErr } = await supabase.storage.from("voicemails").upload(objectPath, buffer, {
    contentType: file.type || "audio/mpeg",
    upsert: true,
  })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Update new columns + legacy columns for maximum compatibility
  const updatePayload: Record<string, any> = {}

  if (type === "in") {
    // New
    updatePayload.voicemail_in_mode = "audio"
    updatePayload.voicemail_in_audio_path = objectPath
    // Legacy
    updatePayload.voicemail_type = "audio"
    updatePayload.voicemail_audio_path = objectPath
  } else {
    // New
    updatePayload.voicemail_out_mode = "audio"
    updatePayload.voicemail_out_audio_path = objectPath
    // Legacy
    updatePayload.ooh_voicemail_type = "audio"
    updatePayload.ooh_voicemail_audio_path = objectPath
  }

  const { error: updErr } = await supabase.from("users").update(updatePayload).eq("id", userId)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, path: objectPath, type })
}