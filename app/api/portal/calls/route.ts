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

/**
 * Week start: Monday 00:01 (local time)
 * Week end: Sunday 23:59
 * We compute range start and then query from start -> now.
 */
function getWeekStartMonday0001Local(now: Date) {
  const d = new Date(now)
  const day = d.getDay() // Sun=0, Mon=1...
  const daysSinceMonday = (day + 6) % 7 // Mon->0, Tue->1 ... Sun->6
  d.setDate(d.getDate() - daysSinceMonday)
  d.setHours(0, 1, 0, 0) // 00:01
  return d
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

  const now = new Date()
  const weekStart = getWeekStartMonday0001Local(now)

  // --- STATS: entire current week (Mon 00:01 -> now) ---
  // Only select what we need to compute counts (cheap).
  const { data: weekRows, error: weekErr } = await admin
    .from("calls")
    .select(["answered_live", "sms_sent", "recording_url", "recording_duration", "created_at"].join(","))
    .eq("user_id", user.id)
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", now.toISOString())

  if (weekErr) return NextResponse.json({ error: weekErr.message }, { status: 500 })

  let weekTotal = 0
  let weekAnswered = 0
  let weekSms = 0
  let weekVoicemail = 0

  for (const r of weekRows || []) {
    weekTotal++
    if ((r as any).answered_live === true) weekAnswered++
    if ((r as any).sms_sent === true) weekSms++
    if (computeVoicemailLeft(r)) weekVoicemail++
  }

  // --- PAGED CALLS LIST ---
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
    stats: {
      week_start: weekStart.toISOString(),
      now: now.toISOString(),
      week_total: weekTotal,
      week_answered: weekAnswered,
      week_sms: weekSms,
      week_voicemail: weekVoicemail,
    },
  })

  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}