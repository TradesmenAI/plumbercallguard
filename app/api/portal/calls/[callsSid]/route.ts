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
    const params = await Promise.resolve(context?.params)
    const callsSid = String(params?.callsSid ?? params?.callSid ?? "").trim()

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

    // Get this user's Twilio number (for legacy calls where calls.user_id was null)
    const { data: userRow, error: userRowErr } = await admin
      .from("users")
      .select("twilio_number")
      .eq("id", user.id)
      .maybeSingle()

    if (userRowErr) {
      return NextResponse.json({ error: "Failed to load user" }, { status: 500 })
    }

    const twilioNumber = String(userRow?.twilio_number ?? "").trim()

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

    // Match either:
    // - user_id == auth user (new/clean)
    // - inbound_to == user's twilio_number (legacy/unassigned)
    const orParts = [`user_id.eq.${user.id}`]
    if (twilioNumber) orParts.push(`inbound_to.eq.${twilioNumber}`)

    const { data, error } = await admin
      .from("calls")
      .select(selectCols)
      .eq("call_sid", callsSid)
      .or(orParts.join(","))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { error: "Not found", debug: { callsSid, twilioNumber, matchedOr: orParts } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    )
  }
}