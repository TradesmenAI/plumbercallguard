import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/app/lib/supabaseServer"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const VOICEMAIL_SECONDS_THRESHOLD = 3

function computeVoicemailLeft(row: any): boolean {
  const dur = Number(row?.recording_duration || 0)
  return !!row?.recording_url && dur >= VOICEMAIL_SECONDS_THRESHOLD
}

function computeStatus(row: any): "answered" | "sms" | "voicemail" {
  if (row?.answered_live === true) return "answered"
  if (computeVoicemailLeft(row)) return "voicemail"
  return "sms"
}

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = parseInt(String(v ?? ""), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export async function GET(req: NextRequest) {
  const { supabase, res } = createSupabaseServerClient(req)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)

  const limit = clampInt(searchParams.get("limit"), 1, 50, 20)
  const offset = clampInt(searchParams.get("offset"), 0, 10_000, 0)

  // Fetch one extra row so we can tell if there are more
  const fetchCount = limit + 1

  const { data, error } = await admin
    .from("calls")
    .select(
      [
        "call_sid",
        "caller_number",
        "caller_name",
        "name_source",
        "ai_summary",
        "recording_url",
        "recording_duration",
        "created_at",
        "sms_sent",
        "answered_live",
      ].join(",")
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + fetchCount - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const has_more = rows.length > limit
  const page = has_more ? rows.slice(0, limit) : rows

  const calls = page.map((row: any) => {
    const voicemail_left = computeVoicemailLeft(row)

    return {
      id: row.call_sid,
      from_number: row.caller_number,

      caller_name: row.caller_name ?? null,
      name_source: row.name_source ?? null,

      customer_type: "new",

      voicemail_left,
      sms_sent: row?.sms_sent === true,
      answered_live: row?.answered_live === true,

      status: computeStatus(row),

      ai_summary: row.ai_summary ?? null,
      created_at: row.created_at,
    }
  })

  const json = NextResponse.json({
    data: calls,
    has_more,
    next_offset: has_more ? offset + limit : offset + calls.length,
  })

  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}