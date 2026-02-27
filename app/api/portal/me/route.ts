import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// Service role client (server-only) to read/update public.users safely
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Auth client (reads session from cookies)
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch only this user's row from public.users (no tokens returned)
  const { data, error } = await admin
    .from("users")
    .select(
      [
        "id",
        "email",
        "full_name",
        "business_name",
        "plan",
        "timezone",
        "business_hours",
        "tts_voice_gender",
        "voicemail_in_mode",
        "voicemail_in_tts",
        "voicemail_in_audio_path",
        "voicemail_out_mode",
        "voicemail_out_tts",
        "voicemail_out_audio_path",
      ].join(",")
    )
    .eq("id", user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 })
  }

  // Return JSON + preserve any auth cookie refresh that happened
  const json = NextResponse.json({ data })
  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}