import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST JSON:
 * {
 *   "timezone": "Europe/London",
 *   "business_hours": {
 *     "mon": {"enabled":true,"start":"09:00","end":"17:00"},
 *     "tue": {"enabled":true,"start":"09:00","end":"17:00"},
 *     "wed": {"enabled":true,"start":"09:00","end":"17:00"},
 *     "thu": {"enabled":true,"start":"09:00","end":"17:00"},
 *     "fri": {"enabled":true,"start":"09:00","end":"17:00"},
 *     "sat": {"enabled":false,"start":"09:00","end":"13:00"},
 *     "sun": {"enabled":false,"start":"10:00","end":"12:00"}
 *   }
 * }
 *
 * Auth: Authorization: Bearer <supabase_access_token>
 * Pro-only
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (!bearer) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 })

  const { data: authData, error: authErr } = await supabase.auth.getUser(bearer)
  if (authErr || !authData?.user?.id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const userId = authData.user.id
  const body = (await req.json().catch(() => null)) as any

  const { data: userRow } = await supabase.from("users").select("plan").eq("id", userId).single()
  const plan = String(userRow?.plan || "standard").toLowerCase()
  const isPro = plan === "pro"

  if (!isPro) {
    return NextResponse.json({ error: "Business hours scheduling is Pro only" }, { status: 403 })
  }

  const timezone = String(body?.timezone || "Europe/London")
  const business_hours = body?.business_hours

  if (!business_hours || typeof business_hours !== "object") {
    return NextResponse.json({ error: "business_hours is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("users")
    .update({ timezone, business_hours })
    .eq("id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}