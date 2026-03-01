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

export async function GET(req: NextRequest, context: unknown) {
  const { supabase, res } = createSupabaseServerClient(req)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rawParams = (context as any)?.params
  const params = await Promise.resolve(rawParams)
  const callSid = String(params?.callSid || "").trim()

  if (!callSid) return NextResponse.json({ error: "Missing callSid" }, { status: 400 })

  const { data, error } = await admin
    .from("calls")
    .select(
      [
        "id",
        "call_sid",
        "user_id",
        "caller_number",
        "caller_type",
        "inbound_to",
        "call_status",
        "sms_sent",
        "answered_live",
        "recording_url",
        "recording_duration",
        "ai_summary",
        "transcript",
        "caller_name",
        "name_source",
        "created_at",
      ].join(",")
    )
    .eq("user_id", user.id)
    .eq("call_sid", callSid)
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const row: any = data

  const json = NextResponse.json({
    data: {
      ...row,
      voicemail_left: computeVoicemailLeft(row),
    },
  })

  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}