"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getDisplayOutcome, outcomeChipClasses } from "@/app/lib/callOutcome"

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
  call_outcome: string | null
  dial_call_duration: number | null
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

type CallsApiResponse = {
  data: Call[]
  has_more: boolean
  next_offset: number
  stats?: ApiStats
}

function cleanNumber(n: string | null | undefined) {
  return String(n || "").replace(/\s+/g, "")
}

function clampText(s: string | null | undefined, max = 90) {
  const t = String(s || "").trim()
  if (!t) return ""
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

function formatDisplayNumber(n: string | null | undefined) {
  const value = cleanNumber(n)
  if (!value) return "Unknown number"
  if (value.startsWith("+44") && value.length >= 13) {
    return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 10)} ${value.slice(10)}`.trim()
  }
  return value
}

export default function InboxPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const PAGE_SIZE = 20
  const initialQ = searchParams.get("q") || ""

  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [query, setQuery] = useState(initialQ)
  const [committedQuery, setCommittedQuery] = useState(initialQ)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const fetchCalls = useCallback(
    async (offset: number, nextQuery: string) => {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })

      if (nextQuery.trim()) qs.set("q", nextQuery.trim())
      if (offset === 0) qs.set("include_stats", "1")

      const res = await fetch(`/api/portal/calls?${qs.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const j = (await res.json().catch(() => null)) as CallsApiResponse | null
      if (!res.ok) throw new Error((j as any)?.error || "Failed to load calls")
      return j || { data: [], has_more: false, next_offset: offset }
    },
    [PAGE_SIZE]
  )

  useEffect(() => {
    let cancelled = false

    async function run() {
      setErr(null)
      setLoading(true)
      try {
        const response = await fetchCalls(0, committedQuery)
        if (cancelled) return

        setCalls(response.data || [])
        setStats(response.stats || null)
        setHasMore(!!response.has_more)
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
  }, [committedQuery, fetchCalls])

  const onShowMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setErr(null)

    try {
      const response = await fetchCalls(calls.length, committedQuery)

      setCalls((prev) => {
        const merged = [...prev, ...(response.data || [])]
        const seen = new Set<string>()
        return merged.filter((c) => {
          if (!c?.id) return false
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        })
      })

      setHasMore(!!response.has_more)
    } catch (e: any) {
      setErr(e?.message || "Failed")
    } finally {
      setLoadingMore(false)
    }
  }, [calls.length, committedQuery, fetchCalls, hasMore, loadingMore])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) onShowMore()
      },
      { rootMargin: "300px 0px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onShowMore])

  const fallbackWeek = useMemo(() => {
    const total = calls.length
    const live = calls.filter((c) => c.answered_live).length
    const sms = calls.filter((c) => c.sms_sent).length
    const voicemail = calls.filter((c) => c.voicemail_left).length
    return { total, live, sms, voicemail }
  }, [calls])

  const week = stats?.week ?? fallbackWeek
  const today = stats?.today ?? { total: 0, missed: 0 }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = query.trim()
    setCommittedQuery(next)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    if (next) params.set("q", next)
    else params.delete("q")
    router.replace(`/portal/inbox${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearSearch() {
    setQuery("")
    setCommittedQuery("")
    router.replace("/portal/inbox")
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-slate-900">Full call logs</div>
            <div className="text-sm text-slate-500">Search every caller thread and load more as you scroll.</div>
          </div>

          <Link
            href="/portal"
            prefetch
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to portal
          </Link>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[1.7fr_1fr]">
          <form onSubmit={onSearchSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search call logs</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by number or name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Search
                  </button>
                  {committedQuery ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
            </label>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900">This week</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Calls</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{week.total}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Live</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{week.live}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">SMS</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{week.sms}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Missed today</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{today.missed}</div>
              </div>
            </div>
          </div>
        </div>

        {loading && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">Loading calls...</div>}
        {!loading && err && <div className="rounded-2xl border border-rose-200 bg-white p-4 text-rose-600">{err}</div>}

        {!loading && !err && (
          <div className="grid gap-3">
            {calls.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-600">
                {committedQuery ? "No callers matched your search." : "No calls yet."}
              </div>
            ) : (
              calls.map((call) => {
                const num = cleanNumber(call.caller_number)
                const summary = clampText(call.ai_summary || call.transcript || "", 92)
                const detailsKey = (call.call_sid && String(call.call_sid).trim()) || call.id
                const outcomeLabel = getDisplayOutcome(call)
                const outcomeClasses = outcomeChipClasses(outcomeLabel)

                return (
                  <div
                    key={call.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-bold text-slate-900">{formatDisplayNumber(call.caller_number)}</div>
                        {call.caller_name ? (
                          <div className="truncate text-sm text-slate-600">
                            {call.caller_name}
                            {call.name_source === "ai" ? <span className="ml-1 font-bold text-amber-500">!</span> : null}
                          </div>
                        ) : null}
                        {outcomeLabel ? (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeClasses}`}>{outcomeLabel}</span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{call.created_at ? new Date(call.created_at).toLocaleString() : "Unknown time"}</span>
                        {call.customer_type === "new" ? <span className="font-semibold text-slate-700">New caller</span> : null}
                      </div>

                      {summary ? <div className="mt-2 text-sm text-slate-600">{summary}</div> : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={`tel:${num}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white hover:bg-lime-700"
                      >
                        📞 Call back
                      </a>
                      <Link
                        href={`/portal/calls/${encodeURIComponent(detailsKey)}`}
                        prefetch
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open thread
                      </Link>
                    </div>
                  </div>
                )
              })
            )}

            <div ref={loadMoreRef} className="h-6" aria-hidden="true" />

            {loadingMore ? <div className="text-center text-sm text-slate-500">Loading more...</div> : null}
            {!hasMore && calls.length > 0 ? <div className="text-center text-xs text-slate-400">You’ve reached the end.</div> : null}
          </div>
        )}
      </div>
    </div>
  )
}
