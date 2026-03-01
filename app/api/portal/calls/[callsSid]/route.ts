import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeE164(input: string | null | undefined) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const callsSid = String(params?.callsSid ?? "").trim()

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

    // Load this user's Twilio number (used for legacy call ownership check)
    const { data: userRow, error: userRowErr } = await admin
      .from("users")
      .select("twilio_number")
      .eq("id", user.id)
      .maybeSingle()

    if (userRowErr) {
      return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
    }

    const twilioNumber = normalizeE164(userRow?.twilio_number)

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

    // 1) Fetch the call by call_sid ONLY (no filtering yet)
    const { data: call, error: callErr } = await admin
      .from("calls")
      .select(selectCols)
      .eq("call_sid", callsSid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (callErr || !call) {
      return NextResponse.json(
        { error: "Not found", debug: { callsSid } },
        { status: 404 }
      )
    }

    // 2) Authorize in code (supports formatting differences)
    const callInboundTo = normalizeE164(call.inbound_to)
    const isOwnedByUserId = call.user_id === user.id
    const isOwnedByTwilioNumber =
      !!twilioNumber && !!callInboundTo && callInboundTo === twilioNumber

    if (!isOwnedByUserId && !isOwnedByTwilioNumber) {
      return NextResponse.json(
        {
          error: "Not found",
          debug: {
            callsSid,
            twilioNumber,
            callInboundTo,
            isOwnedByUserId,
            isOwnedByTwilioNumber,
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: call })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    )
  }
}