import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function getCallsSid(context: any) {
  // Folder is [callsSid] so Next exposes params.callsSid
  const raw = context?.params?.callsSid ?? context?.params?.callSid
  if (!raw) return ""
  return Array.isArray(raw) ? String(raw[0] || "") : String(raw)
}

export async function GET(req: NextRequest, context: any) {
  try {
    const callsSid = getCallsSid(context)
    if (!callsSid) {
      return NextResponse.json({ error: "Missing callSid" }, { status: 400 })
    }

    // ✅ IMPORTANT: in your Next version, cookies() is async here
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // no-op in route handlers (we only need to READ auth cookies here)
          },
        },
      }
    )

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authData.user

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
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}