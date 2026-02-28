import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/app/lib/supabaseServer"

export const runtime = "nodejs"

// Service role (server-only)
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function computeInboxStatus(row: any): "answered" | "sms" | "voicemail" {
  const explicit = String(row?.inbox_status || "").toLowerCase()
  if (explicit === "answered" || explicit === "sms" || explicit === "voicemail") return explicit as any

  const dur = Number(row?.recording_duration || 0)
  const hasVoicemail = !!row?.recording_url && dur >= 2
  if (hasVoicemail) return "voicemail"

  if (row?.sms_sent === true) return "sms"

  const callStatus = String(row?.call_status || "").toLowerCase()
  if (callStatus === "completed") return "sms"

  return "sms"
}

export async function GET(req: NextRequest) {
  const { supabase, res } = createSupabaseServerClient(req)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "30", 10), 1), 100)

  const { data, error } = await admin
    .from("calls")
    .select(
      [
        "call_sid",
        "caller_number",
        "caller_name",
        "name_source",
        "customer_type",
        "inbox_status",
        "sms_sent",
        "call_status",
        "recording_url",
        "recording_duration",
        "ai_summary",
        "created_at",
      ].join(",")
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const calls = (data || []).map((row: any) => ({
    id: row.call_sid,
    from_number: row.caller_number,
    caller_name: row.caller_name ?? null,
    name_source: row.name_source ?? null,
    customer_type: row.customer_type ?? "new",
    status: computeInboxStatus(row),
    ai_summary: row.ai_summary ?? null,
    created_at: row.created_at,
  }))

  const json = NextResponse.json({ data: calls })
  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}