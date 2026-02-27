import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function contentTypeFromPath(path: string) {
  const lower = path.toLowerCase()
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  return "application/octet-stream"
}

export async function GET(req: Request, { params }: { params: { userId: string; type: string } }) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  const userId = params.userId
  const type = params.type === "out" ? "out" : "in"

  if (!userId) return new NextResponse("Missing userId", { status: 400 })

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select(
      [
        "voicemail_token",
        "voicemail_in_audio_path",
        "voicemail_out_audio_path",
        "voicemail_audio_path",
        "ooh_voicemail_audio_path",
      ].join(",")
    )
    .eq("id", userId)
    .single()

  if (userErr || !user) return new NextResponse("User not found", { status: 404 })

  if (!token || token !== String(user.voicemail_token)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // Prefer new columns, fall back to legacy columns
  const audioPath =
    type === "out"
      ? (user.voicemail_out_audio_path || user.ooh_voicemail_audio_path)
      : (user.voicemail_in_audio_path || user.voicemail_audio_path)

  if (!audioPath) return new NextResponse("No voicemail audio configured", { status: 404 })

  const { data, error } = await supabase.storage.from("voicemails").download(audioPath)
  if (error || !data) return new NextResponse("Failed to fetch audio", { status: 500 })

  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentTypeFromPath(audioPath),
      "Cache-Control": "no-store",
    },
  })
}