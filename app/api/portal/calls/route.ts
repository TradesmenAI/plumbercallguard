import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/app/lib/supabaseServer"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const VOICEMAIL_SECONDS_THRESHOLD = 3

type CallRow = {
  id: string
  call_sid: string | null
  caller_number: string | null
  inbound_to: string | null
  caller_name: string | null
  name_source: "ai" | "manual" | null
  ai_summary: string | null
  transcript: string | null
  recording_url: string | null
  recording_duration: number | null
  created_at: string | null
  sms_sent: boolean | null
  answered_live: boolean | null
  call_outcome: string | null
  dial_call_duration: number | null
}

function computeVoicemailLeft(row: Partial<CallRow>): boolean {
  const dur = Number(row?.recording_duration || 0)
  return !!row?.recording_url && dur >= VOICEMAIL_SECONDS_THRESHOLD
}

function clampInt(v: string | null, min: number, max: number, fallback: number) {
  const n = parseInt(String(v ?? ""), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function normalizeDigits(v: string | null | undefined) {
  return String(v || "").replace(/[^\d+]/g, "")
}

function getWeekStartMonday0001Local(now: Date) {
  const d = new Date(now)
  const day = d.getDay()
  const daysSinceMonday = (day + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  d.setHours(0, 1, 0, 0)
  return d
}

function applySearch(query: any, q: string) {
  const trimmed = q.trim()
  if (!trimmed) return query

  const safe = trimmed.replace(/[,%]/g, " ").trim()
  const digits = normalizeDigits(trimmed)
  const parts = [`caller_name.ilike.%${safe}%`]

  if (digits) parts.push(`caller_number.ilike.%${digits}%`)
  else parts.push(`caller_number.ilike.%${safe}%`)

  return query.or(parts.join(","))
}

async function loadStats(userId: string, weekStartIso: string, nowIso: string) {
  const [weekTotalRes, liveRes, smsRes, voicemailRes, todayRowsRes] = await Promise.all([
    admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", weekStartIso)
      .lte("created_at", nowIso),
    admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", weekStartIso)
      .lte("created_at", nowIso)
      .eq("answered_live", true),
    admin
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", weekStartIso)
      .lte("created_at", nowIso)
      .eq("sms_sent", true),
    admin
      .from("calls")
      .select("recording_url,recording_duration")
      .eq("user_id", userId)
      .gte("created_at", weekStartIso)
      .lte("created_at", nowIso)
      .not("recording_url", "is", null),
    admin
      .from("calls")
      .select("answered_live")
      .eq("user_id", userId)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .lte("created_at", nowIso),
  ])

  const weekVoicemail = (voicemailRes.data || []).filter((row: Partial<CallRow>) => computeVoicemailLeft(row)).length
  const todayRows = todayRowsRes.data || []

  return {
    week: {
      total: weekTotalRes.count || 0,
      live: liveRes.count || 0,
      sms: smsRes.count || 0,
      voicemail: weekVoicemail,
    },
    today: {
      total: todayRows.length,
      missed: todayRows.filter((row: any) => row.answered_live !== true).length,
    },
  }
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
  const q = String(searchParams.get("q") || "").trim()
  const includeStats = searchParams.get("include_stats") === "1"
  const uniqueCallers = searchParams.get("unique_callers") === "1"

  const now = new Date()
  const weekStart = getWeekStartMonday0001Local(now)

  let baseQuery = admin
    .from("calls")
    .select(
      [
        "id",
        "call_sid",
        "caller_number",
        "inbound_to",
        "caller_name",
        "name_source",
        "ai_summary",
        "transcript",
        "recording_url",
        "recording_duration",
        "created_at",
        "sms_sent",
        "answered_live",
        "call_outcome",
        "dial_call_duration",
      ].join(",")
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  baseQuery = applySearch(baseQuery, q)

  const fetchWindow = uniqueCallers ? Math.min(120, Math.max(limit * 8, 24)) : limit + 1
  const { data, error } = await baseQuery.range(offset, offset + fetchWindow - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = ((data || []) as unknown) as CallRow[]
  const picked: CallRow[] = []
  const seenNumbers = new Set<string>()

  for (const row of rows) {
    if (!uniqueCallers) {
      picked.push(row)
      continue
    }

    const numberKey = normalizeDigits(row.caller_number)
    if (!numberKey || seenNumbers.has(numberKey)) continue
    seenNumbers.add(numberKey)
    picked.push(row)
    if (picked.length === limit + 1) break
  }

  const has_more = picked.length > limit || (!uniqueCallers && rows.length > limit)
  const page = (has_more ? picked.slice(0, limit) : picked.slice(0, limit)) as CallRow[]

  const pageNumbers = Array.from(new Set(page.map((r) => normalizeDigits(r.caller_number)).filter(Boolean)))
  const firstSeenMap = new Map<string, string>()

  if (pageNumbers.length > 0) {
    const { data: histRows, error: histErr } = await admin
      .from("calls")
      .select("caller_number,created_at")
      .eq("user_id", user.id)
      .in("caller_number", pageNumbers)
      .order("created_at", { ascending: true })
      .limit(1000)

    if (!histErr && histRows) {
      for (const r of histRows as any[]) {
        const num = normalizeDigits(r.caller_number)
        const ts = String(r.created_at || "")
        if (num && ts && !firstSeenMap.has(num)) firstSeenMap.set(num, ts)
      }
    }
  }

  const calls = page.map((row) => {
    const callerNumber = normalizeDigits(row.caller_number)
    const createdAt = String(row.created_at || "")
    const firstSeen = firstSeenMap.get(callerNumber)

    return {
      id: row.id,
      call_sid: row.call_sid ?? null,
      caller_number: row.caller_number ?? null,
      inbound_to: row.inbound_to ?? null,
      caller_name: row.caller_name ?? null,
      name_source: row.name_source ?? null,
      customer_type: firstSeen && createdAt && firstSeen === createdAt ? "new" : "existing",
      voicemail_left: computeVoicemailLeft(row),
      sms_sent: row.sms_sent === true,
      answered_live: row.answered_live === true,
      call_outcome: row.call_outcome ?? null,
      dial_call_duration: row.dial_call_duration ?? null,
      ai_summary: row.ai_summary ?? null,
      transcript: row.transcript ?? null,
      recording_duration: row.recording_duration ?? null,
      created_at: row.created_at ?? null,
    }
  })

  const payload: any = {
    data: calls,
    has_more,
    next_offset: offset + page.length,
  }

  if (includeStats) {
    payload.stats = await loadStats(user.id, weekStart.toISOString(), now.toISOString())
  }

  const json = NextResponse.json(payload)
  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}
