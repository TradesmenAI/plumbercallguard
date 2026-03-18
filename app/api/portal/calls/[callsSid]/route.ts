import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import twilio from "twilio"

export const runtime = "nodejs"

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

function normalizeE164(input: string | null | undefined) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

async function getAuthedUser() {
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
  return { user, pendingCookiesResponse: res }
}

async function loadCallRow(key: string) {
  let callQuery = admin.from("calls").select("*")

  if (isUuid(key)) {
    callQuery = callQuery.eq("id", key)
  } else {
    callQuery = callQuery.eq("call_sid", key)
  }

  return await callQuery.maybeSingle()
}

async function getUserTwilio(userId: string) {
  const { data: userRow } = await admin.from("users").select("twilio_number").eq("id", userId).maybeSingle()
  return normalizeE164(userRow?.twilio_number)
}

async function attachRecordingIfMissing(callRow: any) {
  const existingUrl = String(callRow?.recording_url || "").trim()
  const callSid = String(callRow?.call_sid || "").trim()
  if (existingUrl || !callSid) return callRow

  try {
    const recordings = await twilioClient.recordings.list({ callSid, limit: 1 })
    const latest = recordings[0]
    if (!latest?.sid) return callRow

    const mediaUrl = latest.mediaUrl
    const duration = Number(latest.duration ?? 0)
    const nextRecordingUrl = mediaUrl ? `${mediaUrl}.mp3` : ""
    if (!nextRecordingUrl) return callRow

    const { data: updated } = await admin
      .from("calls")
      .update({
        recording_url: nextRecordingUrl,
        recording_duration: duration > 0 ? duration : callRow?.recording_duration ?? null,
      })
      .eq("id", String(callRow.id))
      .select("*")
      .maybeSingle()

    return updated || { ...callRow, recording_url: nextRecordingUrl, recording_duration: duration || callRow?.recording_duration }
  } catch (error) {
    console.error("Failed to attach recording from Twilio", {
      callSid,
      error: error instanceof Error ? error.message : String(error),
    })
    return callRow
  }
}

function applyPendingCookies(json: NextResponse, pendingCookiesResponse: NextResponse) {
  pendingCookiesResponse.cookies.getAll().forEach((c) => json.cookies.set(c.name, c.value, c))
  return json
}

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const raw = String(params?.callsSid || "").trim()

    if (!raw) return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })

    const { user, pendingCookiesResponse } = await getAuthedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const keyDecoded = decodeURIComponent(raw).trim()
    const key = keyDecoded

    const debugOn = req.nextUrl.searchParams.get("t") === "1" || req.nextUrl.searchParams.get("debug") === "1"

    const userTwilio = await getUserTwilio(user.id)

    const loadedCall = await loadCallRow(key)
    let callRow = loadedCall.data

    if (loadedCall.error || !callRow) {
      const payload: any = { error: "Not found" }
      if (debugOn) payload.debug = { callsSid: raw, callsSidDecoded: keyDecoded, isUuid: isUuid(key) }
      const json = NextResponse.json(payload, { status: 404 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    const callUserId = String((callRow as any).user_id || "")
    const callInboundTo = normalizeE164((callRow as any).inbound_to)

    const isOwnedByUserId = callUserId && callUserId === user.id
    const isOwnedByInboundTo = !!userTwilio && !!callInboundTo && callInboundTo === userTwilio

    if (!isOwnedByUserId && !isOwnedByInboundTo) {
      const payload: any = { error: "Forbidden" }
      if (debugOn) payload.debug = { userId: user.id, userTwilio, callUserId, callInboundTo }
      const json = NextResponse.json(payload, { status: 403 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    if (!isOwnedByUserId && isOwnedByInboundTo) {
      await admin.from("calls").update({ user_id: user.id, unassigned: false }).eq("id", (callRow as any).id)
      ;(callRow as any).user_id = user.id
      ;(callRow as any).unassigned = false
    }

    callRow = await attachRecordingIfMissing(callRow)

    const payload: any = { data: callRow }
    if (debugOn) {
      payload.debug = {
        input: {
          callsSid: key,
          callsSidDecoded: keyDecoded,
          isUuid: isUuid(key),
          userId: user.id,
          userTwilio,
        },
        authz: {
          callUserId,
          callInboundTo,
          isOwnedByUserId,
          isOwnedByInboundTo,
          autoAttached: !isOwnedByUserId && isOwnedByInboundTo,
        },
      }
    }

    const json = NextResponse.json(payload, { status: 200 })
    return applyPendingCookies(json, pendingCookiesResponse)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params)
    const raw = String(params?.callsSid || "").trim()
    if (!raw) return NextResponse.json({ error: "Missing callsSid" }, { status: 400 })

    const { user, pendingCookiesResponse } = await getAuthedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const keyDecoded = decodeURIComponent(raw).trim()
    const key = keyDecoded

    const body = await req.json().catch(() => null)
    const nextName = String(body?.caller_name ?? "").trim()

    if (nextName.length > 80) {
      const json = NextResponse.json({ error: "Name too long (max 80 chars)" }, { status: 400 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    const userTwilio = await getUserTwilio(user.id)

    const { data: callRow, error: callErr } = await loadCallRow(key)
    if (callErr || !callRow) {
      const json = NextResponse.json({ error: "Not found" }, { status: 404 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    const callUserId = String((callRow as any).user_id || "")
    const callInboundTo = normalizeE164((callRow as any).inbound_to)

    const isOwnedByUserId = callUserId && callUserId === user.id
    const isOwnedByInboundTo = !!userTwilio && !!callInboundTo && callInboundTo === userTwilio

    if (!isOwnedByUserId && !isOwnedByInboundTo) {
      const json = NextResponse.json({ error: "Forbidden" }, { status: 403 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    if (!isOwnedByUserId && isOwnedByInboundTo) {
      await admin.from("calls").update({ user_id: user.id, unassigned: false }).eq("id", (callRow as any).id)
    }

    const patch: any = { caller_name: nextName ? nextName : null }
    if (nextName) patch.name_source = "manual"

    const { data: updated, error: upErr } = await admin
      .from("calls")
      .update(patch)
      .eq("id", (callRow as any).id)
      .select("*")
      .maybeSingle()

    if (upErr || !updated) {
      const json = NextResponse.json({ error: upErr?.message || "Failed to save" }, { status: 500 })
      return applyPendingCookies(json, pendingCookiesResponse)
    }

    const json = NextResponse.json({ data: updated }, { status: 200 })
    return applyPendingCookies(json, pendingCookiesResponse)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
