"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Call = {
  id: string
  call_sid: string | null

  caller_number: string | null
  inbound_to: string | null

  caller_name: string | null
  name_source: "ai" | "manual" | null

  ai_summary: string | null
  transcript: string | null

  sms_sent: boolean | null
  voicemail_left: boolean | null
  answered_live: boolean | null

  recording_duration: number | null
  created_at: string | null

  customer_type?: "new" | "existing" | null
}

type ApiStats = {
  week?: {
    total: number
    live: number
    sms: number
    voicemail: number
  }
  today?: {
    total: number
    missed: number
  }
}

function cleanNumber(n: string | null | undefined) {
  return String(n || "").replace(/\s+/g, "")
}

function clampText(s: string | null | undefined, max = 90) {
  const t = String(s || "").trim()
  if (!t) return ""
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

export default function InboxPage() {
  const router = useRouter()

  const PAGE_SIZE = 20

  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const [stats, setStats] = useState<ApiStats | null>(null)

  async function fetchCalls(offset: number) {
    const res = await fetch(`/api/portal/calls?limit=${PAGE_SIZE}&offset=${offset}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })

    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.error || "Failed to load calls")

    const rows: Call[] = (j?.data || []) as Call[]
    const apiStats: ApiStats | null = (j?.stats || null) as ApiStats | null

    return { rows, apiStats }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setErr(null)
      setLoading(true)
      try {
        const { rows, apiStats } = await fetchCalls(0)
        if (cancelled) return

        setCalls(rows)
        setStats(apiStats)
        setHasMore(rows.length === PAGE_SIZE)
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  async function onShowMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setErr(null)

    try {
      const offset = calls.length
      const { rows } = await fetchCalls(offset)

      setCalls((prev) => {
        const merged = [...prev, ...rows]
        const seen = new Set<string>()
        return merged.filter((c) => {
          if (!c?.id) return false
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
      })

      setHasMore(rows.length === PAGE_SIZE)
    } catch (e: any) {
      setErr(e?.message || "Failed")
    } finally {
      setLoadingMore(false)
    }
  }

  const fallbackWeek = useMemo(() => {
    const total = calls.length
    const live = calls.filter((c) => c.answered_live).length
    const sms = calls.filter((c) => c.sms_sent).length
    const voicemail = calls.filter((c) => c.voicemail_left).length
    return { total, live, sms, voicemail }
  }, [calls])

  const week = stats?.week ?? fallbackWeek
  const today = stats?.today ?? { total: 0, missed: 0 }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">Inbox</div>
            <div className="text-sm text-slate-500">Recent activity from your business line</div>
          </div>

          <button
            onClick={() => router.push("/portal")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900">This Week</div>
              <div className="mt-1 text-sm text-slate-700">
                <span className="font-semibold">{week.total}</span> calls{" "}
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold">{week.live}</span> live{" "}
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold">{week.sms}</span> SMS{" "}
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold">{week.voicemail}</span> voicemail
              </div>

              <div className="mt-1 text-xs text-slate-500">instant follow-ups ⚡</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Today: <span className="font-semibold">{today.total}</span>{" "}
              <span className="mx-2 text-slate-300">•</span>
              Missed: <span className="font-semibold">{today.missed}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white">✓</span>
              Answered Live
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 text-purple-700">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white">✉️</span>
              Contacted via SMS
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-blue-700">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white">🎙️</span>
              Voicemail Left
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white">!</span>
              AI Name
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
            Loading...
          </div>
        )}

        {!loading && err && (
          <div className="rounded-2xl border border-rose-200 bg-white p-4 text-rose-600">{err}</div>
        )}

        {!loading && !err && (
          <div className="grid gap-3">
            {calls.map((call) => {
              const num = cleanNumber(call.caller_number)
              const showNewCaller = call.customer_type === "new"
              const summary = clampText(call.ai_summary || call.transcript || "", 92)

              // ✅ idiot-proof: prefer call_sid, fallback to row id
              const detailsKey = (call.call_sid && String(call.call_sid).trim()) || call.id

              return (
                <div
                  key={call.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex shrink-0 items-center gap-2">
                    {call.sms_sent ? (
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700">
                        ✉️
                      </div>
                    ) : (
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300" />
                    )}

                    {call.voicemail_left ? (
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                        🎙️
                      </div>
                    ) : (
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{num || "Unknown number"}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">
                      {call.caller_name ? (
                        <span className="font-semibold text-slate-900">
                          {call.caller_name}
                          {call.name_source === "ai" ? <span className="ml-1 text-amber-500">!</span> : null}
                        </span>
                      ) : (
                        <span>No name</span>
                      )}

                      {showNewCaller ? (
                        <>
                          <span className="mx-2 text-slate-300">•</span>
                          <span className="text-slate-700">New caller</span>
                        </>
                      ) : null}

                      {summary ? (
                        <>
                          <span className="mx-2 text-slate-300">•</span>
                          <span className="text-slate-500">{summary}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={num ? `tel:${num}` : undefined}
                      onClick={(e) => {
                        if (!num) e.preventDefault()
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${
                        num ? "bg-lime-600 hover:bg-lime-700" : "bg-slate-300 cursor-not-allowed"
                      }`}
                    >
                      <span className="text-base">📞</span>
                      CALL <span className="opacity-90">›</span>
                    </a>

                    <button
                      onClick={() => router.push(`/portal/calls/${encodeURIComponent(detailsKey)}`)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                      aria-label="Open details"
                      title="Open details"
                    >
                      →
                    </button>
                  </div>
                </div>
              )
            })}

            {!loading && !err && calls.length > 0 && (
              <div className="mt-2 flex justify-center">
                {hasMore ? (
                  <button
                    onClick={onShowMore}
                    disabled={loadingMore}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Show more"}
                  </button>
                ) : (
                  <div className="text-xs text-slate-400">No more calls</div>
                )}
              </div>
            )}

            <div className="mt-6 text-center text-xs text-slate-400">
              Tip: mobile callers get an instant SMS after a voicemail.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}