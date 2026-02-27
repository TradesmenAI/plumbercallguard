import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const form = await req.formData()
    const typeRaw = String(form.get("type") || "in")
    const type: "in" | "out" = typeRaw === "out" ? "out" : "in"
    const file = form.get("file") as File | null

    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

    // Check plan for out-of-hours uploads
    const { data: userRow, error: userErr } = await admin
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single()

    if (userErr || !userRow) return NextResponse.json({ error: "User row not found" }, { status: 404 })

    const plan = String(userRow.plan || "standard").toLowerCase()
    const isPro = plan === "pro"

    if (type === "out" && !isPro) {
      return NextResponse.json({ error: "Out-of-hours MP3 is Pro only" }, { status: 403 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const objectPath = `${user.id}/${type === "out" ? "out-of-hours" : "in-hours"}.mp3`

    const { error: uploadErr } = await admin.storage.from("voicemails").upload(objectPath, buffer, {
      contentType: file.type || "audio/mpeg",
      upsert: true,
    })

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    // Update new + legacy columns
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

    const { error: updErr } = await admin.from("users").update(payload).eq("id", user.id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    const json = NextResponse.json({ success: true, path: objectPath })
    res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 })
  }
}