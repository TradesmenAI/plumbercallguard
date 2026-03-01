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

function basicAuthHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  const encoded = Buffer.from(`${sid}:${token}`).toString("base64")
  return `Basic ${encoded}`
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const raw = String(params?.callsSid || "").trim()
    if (!raw) return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })

    // Supabase auth (cookie-based)
    const cookieStore = await cookies()
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
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const key = decodeURIComponent(raw).trim()

    // Get user's Twilio number (legacy-safe authorization)
    const { data: userRow } = await admin
      .from("users")
      .select("twilio_number")
      .eq("id", user.id)
      .maybeSingle()

    const userTwilio = normalizeE164(userRow?.twilio_number)

    // Load call by UUID id OR call_sid
    let callQuery = admin.from("calls").select("id,user_id,inbound_to,recording_url,unassigned")
    if (isUuid(key)) callQuery = callQuery.eq("id", key)
    else callQuery = callQuery.eq("call_sid", key)

    const { data: callRow, error: callErr } = await callQuery.maybeSingle()

    if (callErr || !callRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const callUserId = String((callRow as any).user_id || "")
    const callInboundTo = normalizeE164((callRow as any).inbound_to)

    const isOwnedByUserId = !!callUserId && callUserId === user.id
    const isOwnedByInboundTo = !!userTwilio && !!callInboundTo && callInboundTo === userTwilio

    if (!isOwnedByUserId && !isOwnedByInboundTo) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Auto-attach legacy calls if needed (safe)
    if (!isOwnedByUserId && isOwnedByInboundTo) {
      await admin.from("calls").update({ user_id: user.id, unassigned: false }).eq("id", (callRow as any).id)
    }

    const recordingUrl = String((callRow as any).recording_url || "").trim()
    if (!recordingUrl) return NextResponse.json({ error: "No recording" }, { status: 404 })

    const authHeader = basicAuthHeader()
    if (!authHeader) {
      return NextResponse.json(
        { error: "Server missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN" },
        { status: 500 }
      )
    }

    // IMPORTANT: support Range requests so the browser can determine duration
    const range = req.headers.get("range") || undefined

    const upstream = await fetch(recordingUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        ...(range ? { Range: range } : {}),
      },
      // Avoid caching stale media responses
      cache: "no-store",
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: `Upstream failed (${upstream.status})` }, { status: 502 })
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg"
    const contentLength = upstream.headers.get("content-length")
    const contentRange = upstream.headers.get("content-range")
    const acceptRanges = upstream.headers.get("accept-ranges") || "bytes"

    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Accept-Ranges", acceptRanges)
    headers.set("Cache-Control", "no-store")

    if (contentLength) headers.set("Content-Length", contentLength)
    if (contentRange) headers.set("Content-Range", contentRange)

    // Pass through status (200 or 206)
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}