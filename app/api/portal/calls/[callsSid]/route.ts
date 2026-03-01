import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

function normalizeE164(input: string | null | undefined) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

// Next has flipped cookies() between sync/async across versions.
// This keeps it working either way.
async function getCookieStore() {
  const c: any = cookies()
  if (c && typeof c.then === "function") return await c
  return c
}

type CallRow = {
  id: string
  call_sid: string
  caller_number: string | null
  caller_type: string | null
  caller_name: string | null
  name_source: "ai" | "manual" | null
  inbound_to: string | null
  recording_url: string | null
  recording_duration: number | null
  ai_summary: string | null
  transcript: string | null
  sms_sent: boolean | null
  voicemail_left: boolean | null
  answered_live: boolean | null
  created_at: string | null
  user_id: string | null
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const callsSid = String(params?.callsSid ?? "").trim()

    if (!callsSid) {
      return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })
    }

    // 1) Read authed user (Supabase cookies)
    const cookieStore = await getCookieStore()
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
            cookiesToSet.forEach(({ name, value, options }: any) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2) Admin client to fetch + authorize
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Fetch call FIRST (no auth filters)
    const { data: call, error: callErr } = await admin
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
      .eq("call_sid", callsSid)
      .maybeSingle<CallRow>()

    if (callErr || !call) {
      return NextResponse.json({ error: "Not found", debug: { callsSid } }, { status: 404 })
    }

    // Authorize:
    // A) direct match
    let authorized = call.user_id === user.id

    // B) legacy match by inbound_to == user.twilio_number (normalized)
    if (!authorized) {
      const { data: userRow } = await admin
        .from("users")
        .select("id, twilio_number")
        .eq("id", user.id)
        .maybeSingle<{ id: string; twilio_number: string | null }>()

      const userTwilio = normalizeE164(userRow?.twilio_number)
      const callInboundTo = normalizeE164(call.inbound_to)

      if (userTwilio && callInboundTo && userTwilio === callInboundTo) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Not found", debug: { callsSid } }, { status: 404 })
    }

    const json = NextResponse.json({ data: call })
    cookieStore.getAll().forEach((c: any) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}