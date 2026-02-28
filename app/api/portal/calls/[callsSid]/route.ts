import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, context: any) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rawParams = context?.params
  const params = await Promise.resolve(rawParams)
  const callSid = String(params?.callSid || "")

  if (!callSid) return NextResponse.json({ error: "Missing callSid" }, { status: 400 })

  const { data, error } = await admin
    .from("calls")
    .select("*")
    .eq("user_id", user.id)
    .eq("call_sid", callSid)
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const json = NextResponse.json({ data })
  res.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value))
  return json
}