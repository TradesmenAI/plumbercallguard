import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest, context: any) {
  try {
    // ✅ Robust: support either [callsSid] or [callSid] folder naming
    const callsSid = String(
      context?.params?.callsSid ?? context?.params?.callSid ?? ""
    ).trim()

    if (!callsSid) {
      return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const res = NextResponse.next()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = auth.user

    const { data, error } = await admin
      .from("calls")
      .select(
        [
          "id",
          "call_sid",
          "caller_number",
          "caller_type",
          "caller_name",
          "name_source",
          "inbound_to",
          "recording_url",
          "recording_duration",
          "ai_summary",
          "transcript",
          "sms_sent",
          "voicemail_left",
          "answered_live",
          "created_at",
          "user_id",
        ].join(",")
      )
      .eq("user_id", user.id)
      .eq("call_sid", callsSid)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    )
  }
}