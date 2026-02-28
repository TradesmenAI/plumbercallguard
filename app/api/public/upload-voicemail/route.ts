import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdminKey } from "../_guard"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function extFromFile(file: File) {
  const name = (file.name || "").toLowerCase()
  if (name.endsWith(".mp3")) return "mp3"
  if (name.endsWith(".wav")) return "wav"
  if (name.endsWith(".m4a")) return "m4a"
  if (name.endsWith(".ogg")) return "ogg"

  const mime = (file.type || "").toLowerCase()
  if (mime.includes("mpeg")) return "mp3"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a"
  if (mime.includes("ogg")) return "ogg"

  // safe default
  return "mp3"
}

function contentTypeFromExt(ext: string) {
  if (ext === "mp3") return "audio/mpeg"
  if (ext === "wav") return "audio/wav"
  if (ext === "m4a") return "audio/mp4"
  if (ext === "ogg") return "audio/ogg"
  return "application/octet-stream"
}

export async function POST(req: NextRequest) {
  // ✅ Admin-only (until real portal)
  const guard = requireAdminKey(req)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  try {
    const form = await req.formData()

    const userId = String(form.get("userId") || "")
    const token = String(form.get("token") || "")
    const type = String(form.get("type") || "in") // "in" | "out"
    const file = form.get("file")

    if (!userId || !token) {
      return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    // basic size guard (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 })
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

    if (type === "out" && String(user.plan).toLowerCase() !== "pro") {
      return NextResponse.json({ error: "Pro required for out-of-hours" }, { status: 403 })
    }

    const ext = extFromFile(file)
    const objectPath =
      type === "out"
        ? `${userId}/out-of-hours.${ext}`
        : `${userId}/in-hours.${ext}`

    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: upErr } = await admin.storage
      .from("voicemails")
      .upload(objectPath, bytes, {
        upsert: true,
        contentType: contentTypeFromExt(ext),
      })

    if (upErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    // ✅ Update both new + legacy columns (so nothing breaks)
    const patch: any = {}

    if (type === "out") {
      patch.voicemail_out_audio_path = objectPath
      patch.voicemail_out_mode = "audio"

      // legacy
      patch.ooh_voicemail_audio_path = objectPath
      patch.ooh_voicemail_type = "audio"
    } else {
      patch.voicemail_in_audio_path = objectPath
      patch.voicemail_in_mode = "audio"

      // legacy
      patch.voicemail_audio_path = objectPath
      patch.voicemail_type = "audio"
    }

    const { error: perr } = await admin.from("users").update(patch).eq("id", userId)
    if (perr) return NextResponse.json({ error: "Failed to save file path" }, { status: 500 })

    return NextResponse.json({ ok: true, path: objectPath })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad request" }, { status: 400 })
  }
}