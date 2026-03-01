import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

function normalizeE164(input: string | null | undefined) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

// Next has flipped cookies() between sync/async across versions.
async function getCookieStore() {
  const c: any = cookies()
  if (c && typeof c.then === "function") return await c
  return c
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
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
    const rawParam = String(params?.callsSid ?? "").trim()
    const callsSid = rawParam
    const callsSidDecoded = (() => {
      try {
        return decodeURIComponent(rawParam)
      } catch {
        return rawParam
      }
    })()

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

    // Admin client (bypasses RLS) for calls data
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Get this user's twilio number (for legacy matching)
    const { data: userRow } = await admin
      .from("users")
      .select("id, twilio_number")
      .eq("id", user.id)
      .maybeSingle<{ id: string; twilio_number: string | null }>()

    const userTwilio = normalizeE164(userRow?.twilio_number)

    const debugMode = req.nextUrl.searchParams.get("debug") === "1"

    // Debug helper: show recent calls that SHOULD be visible to this user
    if (debugMode) {
      const recentByUserId = await admin
        .from("calls")
        .select("id, call_sid, user_id, inbound_to, caller_number, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10)

      const recentByInboundTo = userTwilio
        ? await admin
            .from("calls")
            .select("id, call_sid, user_id, inbound_to, caller_number, created_at")
            .eq("inbound_to", userTwilio)
            .order("created_at", { ascending: false })
            .limit(10)
        : { data: null, error: null }

      return NextResponse.json({
        ok: true,
        input: { callsSid, callsSidDecoded, isUuid: isUuid(callsSid), userId: user.id, userTwilio },
        recent: {
          by_user_id: recentByUserId.data || [],
          by_inbound_to: recentByInboundTo.data || [],
        },
        notes: [
          "If your target call_sid is NOT in recent.by_user_id, your calls are not linked to this auth user_id.",
          "If your target call_sid IS in recent.by_inbound_to (but user_id is null/other), we can safely auto-attach on read.",
        ],
      })
    }

    // 2) Find the call by multiple keys (call_sid exact, decoded, or uuid id)
    const selectCols = [
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

    let call: CallRow | null = null

    // Try call_sid
    {
      const { data } = await admin.from("calls").select(selectCols).eq("call_sid", callsSid).maybeSingle<CallRow>()
      if (data) call = data
    }

    // Try decoded call_sid
    if (!call && callsSidDecoded && callsSidDecoded !== callsSid) {
      const { data } = await admin
        .from("calls")
        .select(selectCols)
        .eq("call_sid", callsSidDecoded)
        .maybeSingle<CallRow>()
      if (data) call = data
    }

    // Try uuid id
    if (!call && isUuid(callsSid)) {
      const { data } = await admin.from("calls").select(selectCols).eq("id", callsSid).maybeSingle<CallRow>()
      if (data) call = data
    }

    if (!call) {
      return NextResponse.json({ error: "Not found", debug: { callsSid, callsSidDecoded } }, { status: 404 })
    }

    // 3) Authorize:
    // A) direct ownership
    let authorized = call.user_id === user.id

    // B) legacy ownership by inbound_to matching the user's twilio_number
    if (!authorized && userTwilio) {
      const callInboundTo = normalizeE164(call.inbound_to)
      if (callInboundTo && callInboundTo === userTwilio) authorized = true
    }

    if (!authorized) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // 4) Optional auto-attach for legacy rows (safe + additive):
    // If inbound_to matches this user's twilio number, but user_id is null/other, attach it.
    if (userTwilio) {
      const callInboundTo = normalizeE164(call.inbound_to)
      if (callInboundTo && callInboundTo === userTwilio && call.user_id !== user.id) {
        await admin.from("calls").update({ user_id: user.id, unassigned: false }).eq("id", call.id)
        call = { ...call, user_id: user.id }
      }
    }

    const json = NextResponse.json({ data: call })
    cookieStore.getAll().forEach((c: any) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}