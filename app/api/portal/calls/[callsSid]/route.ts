import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function normalizeE164(input: string | null | undefined) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Next.js typing differs across versions:
 * - sometimes cookies() is sync
 * - sometimes it's a Promise
 * This helper works with both.
 */
async function getCookieStore() {
  const c: any = cookies()
  if (typeof c?.then === "function") return await c
  return c
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const rawParam = String(params?.callsSid || "").trim()

    if (!rawParam) {
      return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })
    }

    const keyDecoded = decodeURIComponent(rawParam).trim()
    const debugOn = req.nextUrl.searchParams.get("debug") === "1" || req.nextUrl.searchParams.get("t") === "1"

    const cookieStore = await getCookieStore()
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
            cookiesToSet.forEach(({ name, value, options }: any) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: auth, error: authErr } = await supabase.auth.getUser()
    const user = auth?.user
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the user's Twilio number (used ONLY for legacy matching)
    const { data: userRow } = await admin
      .from("users")
      .select("twilio_number")
      .eq("id", user.id)
      .maybeSingle()

    const userTwilio = normalizeE164(userRow?.twilio_number)

    // Lookup: support BOTH call row UUID id and Twilio call_sid in the URL
    const keyIsUuid = isUuid(keyDecoded)

    let callRow: any = null
    let callErr: any = null

    // 1) If UUID, try id first (fastest / most reliable)
    if (keyIsUuid) {
      const r = await admin.from("calls").select("*").eq("id", keyDecoded).maybeSingle()
      callRow = r.data
      callErr = r.error
    }

    // 2) If not found (or not UUID), try call_sid with decoded key
    if (!callRow) {
      const r = await admin.from("calls").select("*").eq("call_sid", keyDecoded).maybeSingle()
      callRow = r.data
      callErr = r.error
    }

    if (callErr || !callRow) {
      const payload: any = { error: "Not found" }
      if (debugOn) {
        payload.debug = {
          rawParam,
          keyDecoded,
          keyIsUuid,
          userId: user.id,
          userTwilio,
          callErr: callErr?.message || String(callErr || ""),
        }
      }
      return NextResponse.json(payload, { status: 404 })
    }

    const callUserId = String(callRow.user_id || "")
    const callInboundTo = normalizeE164(callRow.inbound_to)

    // Authorize:
    // - Owned by this auth user_id
    // - OR legacy-owned by inbound_to == user's twilio_number
    const isOwnedByUserId = !!callUserId && callUserId === user.id
    const isOwnedByInboundTo = !!userTwilio && !!callInboundTo && callInboundTo === userTwilio

    if (!isOwnedByUserId && !isOwnedByInboundTo) {
      const payload: any = { error: "Forbidden" }
      if (debugOn) {
        payload.debug = {
          rawParam,
          keyDecoded,
          keyIsUuid,
          userId: user.id,
          userTwilio,
          callUserId,
          callInboundTo,
        }
      }
      return NextResponse.json(payload, { status: 403 })
    }

    // If legacy match works but user_id is missing/different, auto-attach (safe)
    let autoAttached = false
    if (!isOwnedByUserId && isOwnedByInboundTo) {
      const u = await admin
        .from("calls")
        .update({ user_id: user.id, unassigned: false })
        .eq("id", callRow.id)
        .select("user_id, unassigned")
        .maybeSingle()

      autoAttached = !u.error
      // reflect without re-querying
      callRow.user_id = user.id
      callRow.unassigned = false
    }

    const payload: any = { data: callRow }
    if (debugOn) {
      payload.debug = {
        input: {
          rawParam,
          keyDecoded,
          keyIsUuid,
          userId: user.id,
          userTwilio,
        },
        authz: {
          callUserId,
          callInboundTo,
          isOwnedByUserId,
          isOwnedByInboundTo,
          autoAttached,
        },
      }
    }

    const json = NextResponse.json(payload, { status: 200 })
    cookieStore.getAll().forEach((c: any) => json.cookies.set(c.name, c.value))
    return json
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}