import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get("file") as File
  const plumberId = formData.get("plumberId") as string

  if (!file || !plumberId) {
    return NextResponse.json({ error: "Missing file or plumberId" }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const filePath = `${plumberId}/voicemail.mp3`

  const { error } = await supabase.storage
    .from("voicemails")
    .upload(filePath, fileBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // IMPORTANT: store file path, NOT public URL
  await supabase
    .from("plumbers")
    .update({
      voicemail_type: "audio",
      voicemail_audio_url: filePath,
    })
    .eq("id", plumberId)

  return NextResponse.json({ success: true })
}