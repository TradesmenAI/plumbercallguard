import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function normalizeE164(input: string) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const callSid = String(formData.get("CallSid") || "")
  const fromRaw = String(formData.get("From") || "")
  const toRaw = String(formData.get("To") || "")

  const from = normalizeE164(fromRaw)
  const to = normalizeE164(toRaw)

  const { data: user, error } = await supabase
    .from("users")
    .select("id,email,twilio_number,plan")
    .eq("twilio_number", to)
    .single()

  return NextResponse.json({
    ok: true,
    callSid,
    fromRaw,
    toRaw,
    fromNormalized: from,
    toNormalized: to,
    matchedUser: user || null,
    matchError: error?.message || null,
  })
}