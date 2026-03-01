"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

type Call = {
  id: string
  from_number: string
  caller_name: string | null
  name_source: "ai" | "manual" | null
  customer_type: "new" | "returning"
  ai_summary: string | null
  created_at: string

  voicemail_left: boolean
  sms_sent: boolean
  answered_live: boolean

  status: "answered" | "sms" | "voicemail"
}

type ApiStats = {
  week_start: string
  now: string
  week_total: number
  week_answered: number
  week_sms: number
  week_voicemail: number
}

type CallsResponse = {
  data: Call[]
  has_more: boolean
  next_offset: number
  stats?: ApiStats
}

// NO SPACING. Keep + and digits only.
function formatNumberNoSpaces(n: string) {
  return String(n || "")
    .trim()
    .replace(/[^\d+]/g, "")
}

function isSameIsoDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function InboxPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<Call[]>([])
  const [err, setErr] = useState<string | null>(null)

  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [apiStats, setApiStats] = useState<ApiStats | null>(null)

  const todayStats = useMemo(() => {
    const now = new Date()
    let todayTotal = 0
    let todayMissed = 0

    for (const c of calls) {
      const dt = new Date(c.created_at)
      if (isSameIsoDay(dt, now)) {
        todayTotal++
        if (!c.answered_live) todayMissed++
      }
    }
    return { todayTotal, todayMissed }
  }, [calls])

  async function fetchPage(nextOffset: number, mode: "replace" | "append") {
    const res = await fetch(`/api/portal/calls?limit=20&offset=${nextOffset}`)
    const j = (await res.json().catch(() => ({}))) as Partial<CallsResponse> & { error?: string }
    if (!res.ok) throw new Error(j?.error || "Failed to load calls")

    const newCalls = (j.data || []) as Call[]
    setHasMore(!!j.has_more)
    setOffset(typeof j.next_offset === "number" ? j.next_offset : nextOffset + newCalls.length)

    if (j.stats) setApiStats(j.stats)

    setCalls((prev) => (mode === "replace" ? newCalls : [...prev, ...newCalls]))
  }

  useEffect(() => {
    const run = async () => {
      setErr(null)

      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      if (!user) {
        router.replace("/login?next=/portal/inbox")
        return
      }

      try {
        await fetchPage(0, "replace")
      } catch (e: any) {
        setErr(e?.message || "Failed to load")
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [router])

  async function onShowMore() {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      await fetchPage(offset, "append")
    } catch (e: any) {
      setErr(e?.message || "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
            <p className="text-sm text-slate-500">Recent activity from your business line</p>
          </div>

          <button
            onClick={() => router.push("/portal")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">This Week</div>

              <div className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{apiStats?.week_total ?? 0}</span> calls ·{" "}
                <span className="font-semibold text-slate-900">{apiStats?.week_answered ?? 0}</span> live ·{" "}
                <span className="font-semibold text-slate-900">{apiStats?.week_sms ?? 0}</span> SMS ·{" "}
                <span className="font-semibold text-slate-900">{apiStats?.week_voicemail ?? 0}</span> voicemail
              </div>

              <div className="mt-1 text-xs text-slate-500">instant follow-ups ⚡</div>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
              Today: <span className="font-semibold text-slate-900">{todayStats.todayTotal}</span> · Missed:{" "}
              <span className="font-semibold text-slate-900">{todayStats.todayMissed}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                ✓
              </span>
              Answered Live
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 ring-1 ring-purple-200">
                ✉
              </span>
              Contacted via SMS
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                🎙
              </span>
              Voicemail Left
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 font-bold">
                !
              </span>
              AI Name
            </div>
          </div>
        </div>

        <div className="mt-5">
          {loading && (
            <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">Loading…</div>
          )}

          {err && <div className="rounded-2xl bg-white p-4 text-red-600 shadow-sm ring-1 ring-slate-200">{err}</div>}

          {!loading && !err && calls.length === 0 && (
            <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">No calls yet.</div>
          )}

          <div className="mt-3 space-y-2">
            {calls.map((call) => (
              <div key={call.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex w-[84px] shrink-0 items-center gap-2">
                      {call.answered_live && (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          title="Answered Live"
                        >
                          ✓
                        </span>
                      )}
                      {call.sms_sent && (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 ring-1 ring-purple-200"
                          title="SMS sent"
                        >
                          ✉
                        </span>
                      )}
                      {call.voicemail_left && (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                          title="Voicemail left"
                        >
                          🎙
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{formatNumberNoSpaces(call.from_number)}</div>

                      <div className="truncate text-xs text-slate-600">
                        {/* Name */}
                        {call.caller_name ? (
                          <span className="text-slate-800">
                            {call.caller_name}
                            {call.name_source === "ai" && (
                              <span
                                className="ml-1 font-bold text-amber-600"
                                title="Name detected automatically from transcript (not guaranteed)"
                              >
                                !
                              </span>
                            )}
                          </span>
                        ) : (
                          <span>No name</span>
                        )}

                        {/* New caller only (returning = blank) */}
                        {call.customer_type === "new" && (
                          <>
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="font-semibold text-slate-700">New caller</span>
                          </>
                        )}

                        {/* Summary */}
                        {call.ai_summary ? (
                          <>
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="text-slate-600">{call.ai_summary}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`tel:${call.from_number}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-lime-700"
                    >
                      <span className="text-base">📞</span>
                      CALL
                      <span className="opacity-90">›</span>
                    </a>

                    <button
                      onClick={() => router.push(`/portal/calls/${encodeURIComponent(call.id)}`)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      aria-label="Open details"
                      title="Open details"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && !err && calls.length > 0 && (
            <div className="mt-4 flex justify-center">
              {hasMore ? (
                <button
                  onClick={onShowMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Show more"}
                </button>
              ) : (
                <div className="text-xs text-slate-400">No more calls</div>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-slate-400">Tip: mobile callers get an instant SMS after a voicemail.</div>
        </div>
      </div>
    </div>
  )
}