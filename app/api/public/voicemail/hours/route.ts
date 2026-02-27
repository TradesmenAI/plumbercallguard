import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as any
  const userId = body?.userId as string | undefined
  const token = body?.token as string | undefined
  const timezone = String(body?.timezone || "Europe/London")
  const business_hours = body?.business_hours

  if (!userId || !token) return NextResponse.json({ error: "Missing userId or token" }, { status: 400 })
  if (!business_hours || typeof business_hours !== "object") {
    return NextResponse.json({ error: "business_hours must be an object" }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, voicemail_token")
    .eq("id", userId)
    .single()

  if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (String(user.voicemail_token) !== String(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error: updErr } = await supabase.from("users").update({ timezone, business_hours }).eq("id", userId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}