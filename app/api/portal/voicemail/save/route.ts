import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SaveBody = {
  tts_voice_gender?: "male" | "female"
  voicemail_in_mode?: "tts" | "audio"
  voicemail_in_tts?: string | null
  voicemail_out_mode?: "tts" | "audio"
  voicemail_out_tts?: string | null
  business_hours?: any
  timezone?: string | null
}

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
    const body = (await req.json().catch(() => null)) as SaveBody | null
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

    const update: any = {}

    if (body.tts_voice_gender === "male" || body.tts_voice_gender === "female") {
      update.tts_voice_gender = body.tts_voice_gender
    }

    if (body.voicemail_in_mode === "tts" || body.voicemail_in_mode === "audio") {
      update.voicemail_in_mode = body.voicemail_in_mode
    }
    if (typeof body.voicemail_in_tts === "string" || body.voicemail_in_tts === null) {
      update.voicemail_in_tts = body.voicemail_in_tts
      // keep legacy columns in sync (safe fallback for older code paths)
      update.voicemail_type = "tts"
      update.voicemail_message = body.voicemail_in_tts ?? "Please leave a message after the beep."
    }

    if (body.voicemail_out_mode === "tts" || body.voicemail_out_mode === "audio") {
      update.voicemail_out_mode = body.voicemail_out_mode
    }
    if (typeof body.voicemail_out_tts === "string" || body.voicemail_out_tts === null) {
      update.voicemail_out_tts = body.voicemail_out_tts
      update.ooh_voicemail_type = "tts"
      update.ooh_voicemail_message = body.voicemail_out_tts ?? "We are currently closed. Please leave a message and we will call you back."
    }

    if (body.business_hours !== undefined) {
      update.business_hours = body.business_hours
    }

    if (body.timezone !== undefined) {
      update.timezone = body.timezone
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { error } = await admin.from("users").update(update).eq("id", user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const json = NextResponse.json({ success: true })
    res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save" }, { status: 500 })
  }
}