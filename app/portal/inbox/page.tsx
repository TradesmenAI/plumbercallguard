// app/portal/inbox/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

type Call = {
  id: string
  call_sid: string
  from_number: string

  caller_name: string | null
  name_source: "ai" | "manual" | null

  sms_sent: boolean
  voicemail_left: boolean
  answered_live: boolean

  recording_duration: number | null
  recording_url: string | null
  ai_summary: string | null
  transcript: string | null
  created_at: string

  // optional (some API versions return it)
  customer_type?: "new" | "existing" | null
}

type ApiStats = {
  week_total: number
  week_live: number
  week_sms: number
  week_voicemail: number
  today_total: number
  today_missed: number
}

type ApiResponse = {
  data: Call[]
  stats?: ApiStats
}

const PAGE_SIZE = 20

function stripSpaces(s: string) {
  return String(s || "").replace(/\s+/g, "")
}

function fmtNumberForDisplay(n: string) {
  return stripSpaces(n)
}

export default function InboxPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [calls, setCalls] = useState<Call[]>([])
  const [hasMore, setHasMore] = useState(false)

  const [stats, setStats] = useState<ApiStats>({
    week_total: 0,
    week_live: 0,
    week_sms: 0,
    week_voicemail: 0,
    today_total: 0,
    today_missed: 0,
  })

  const offset = useMemo(() => calls.length, [calls.length])

  async function requireAuthed() {
    const {
      data: { user },
    } = await supabaseBrowser.auth.getUser()

    if (!user) {
      router.replace("/login?next=/portal/inbox")
      return null
    }
    return user
  }

  async function fetchPage(nextOffset: number, includeStats: boolean) {
    const user = await requireAuthed()
    if (!user) return { data: [], stats: undefined as ApiStats | undefined }

    const qs = new URLSearchParams()
    qs.set("limit", String(PAGE_SIZE))
    qs.set("offset", String(nextOffset))
    if (includeStats) qs.set("stats", "1")

    const res = await fetch(`/api/portal/calls?${qs.toString()}`, {
      cache: "no-store",
    })
    const json = (await res.json().catch(() => null)) as ApiResponse | null

    if (!res.ok) {
      throw new Error((json as any)?.error || "Failed to load calls")
    }

    return { data: json?.data || [], stats: json?.stats }
  }

  useEffect(() => {
    let mounted = true

    async function run() {
      setErr(null)
      setLoading(true)
      try {
        const first = await fetchPage(0, true)
        if (!mounted) return

        setCalls(first.data)
        setHasMore(first.data.length === PAGE_SIZE)

        if (first.stats) setStats(first.stats)
      } catch (e: any) {
        if (!mounted) return
        setErr(e?.message || "Failed to load")
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onShowMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setErr(null)

    try {
      const next = await fetchPage(offset, false)
      setCalls((prev) => [...prev, ...next.data])
      setHasMore(next.data.length === PAGE_SIZE)
    } catch (e: any) {
      setErr(e?.message || "Failed to load more")
    } finally {
      setLoadingMore(false)
    }
  }

  function goBack() {
    router.push("/portal")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-slate-700">Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Inbox</h1>
            <div className="text-sm text-slate-500">Recent activity from your business line</div>
          </div>

          <button
            onClick={goBack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        {/* Week card */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">This Week</div>
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-semibold">{stats.week_total}</span> calls &nbsp;•&nbsp;{" "}
                <span className="font-semibold">{stats.week_live}</span> live &nbsp;•&nbsp;{" "}
                <span className="font-semibold">{stats.week_sms}</span> SMS &nbsp;•&nbsp;{" "}
                <span className="font-semibold">{stats.week_voicemail}</span> voicemail
              </div>
              <div className="mt-2 text-xs text-slate-500">
                instant follow-ups <span className="ml-1">⚡</span>
              </div>
            </div>

            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
              Today: <span className="font-extrabold">{stats.today_total}</span> · Missed:{" "}
              <span className="font-extrabold">{stats.today_missed}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-600">✓</span>
              Answered Live
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white">✉️</span>
              Contacted via SMS
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white">🎙️</span>
              Voicemail Left
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-slate-800">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-amber-700">!</span>
              AI Name
            </div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {err}
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {calls.map((call) => {
            const number = fmtNumberForDisplay(call.from_number)

            // Only show “New caller” (never show “Existing”)
            const newCaller = call.customer_type === "new"

            const name = call.caller_name?.trim() || "No name"
            const aiName = call.name_source === "ai"

            return (
              <div
                key={call.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                {/* Left icons */}
                <div className="flex items-center gap-2">
                  {call.answered_live && (
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-200 bg-emerald-50">
                      ✓
                    </div>
                  )}
                  {call.sms_sent && (
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-fuchsia-200 bg-fuchsia-50">
                      ✉️
                    </div>
                  )}
                  {call.voicemail_left && (
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-200 bg-blue-50">
                      🎙️
                    </div>
                  )}
                </div>

                {/* Middle */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-extrabold text-slate-900">{number}</div>
                  </div>

                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <span className="text-slate-800">
                      {name}
                      {aiName && (
                        <span
                          className="ml-1 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-extrabold text-amber-800"
                          title="Name detected automatically from transcript (not guaranteed)"
                        >
                          !
                        </span>
                      )}
                    </span>

                    {newCaller && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500">New caller</span>
                      </>
                    )}

                    {call.ai_summary && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="min-w-0 truncate">{call.ai_summary}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`tel:${stripSpaces(call.from_number)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-lime-600 px-5 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-lime-700"
                  >
                    <span className="text-base">📞</span> CALL <span className="opacity-90">›</span>
                  </a>

                  <button
                    onClick={() => router.push(`/portal/calls/${encodeURIComponent(call.id)}`)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label="Open details"
                    title="Open details"
                  >
                    →
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {!loading && !err && (
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

        <div className="mt-6 text-center text-xs text-slate-400">
          Tip: mobile callers get an instant SMS after a voicemail.
        </div>
      </div>
    </div>
  )
}