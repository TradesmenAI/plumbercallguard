"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"
import { getDisplayOutcome, outcomeChipClasses } from "@/app/lib/callOutcome"

type Call = {
  id: string
  call_sid: string | null
  caller_number: string | null
  caller_name: string | null
  name_source: "ai" | "manual" | null
  ai_summary: string | null
  transcript: string | null
  sms_sent: boolean | null
  voicemail_left: boolean | null
  answered_live: boolean | null
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

type CallsResponse = {
  data: Call[]
  stats?: ApiStats
}

function cleanNumber(n: string | null | undefined) {
  return String(n || "").replace(/\s+/g, "")
}

function formatDisplayNumber(n: string | null | undefined) {
  const value = cleanNumber(n)
  if (!value) return "Unknown number"
  if (value.startsWith("+44") && value.length >= 13) {
    return `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7, 10)} ${value.slice(10)}`.trim()
  }
  return value
}

function clampText(s: string | null | undefined, max = 84) {
  const text = String(s || "").trim()
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export default function PortalHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [stats, setStats] = useState<ApiStats | null>(null)
  const [search, setSearch] = useState("")

  const filteredCalls = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return calls

    return calls.filter((call) => {
      const number = cleanNumber(call.caller_number).toLowerCase()
      const name = String(call.caller_name || "").toLowerCase()
      const summary = String(call.ai_summary || call.transcript || "").toLowerCase()
      return number.includes(q) || name.includes(q) || summary.includes(q)
    })
  }, [calls, search])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setErr(null)
      setLoading(true)

      try {
        const {
          data: { user },
        } = await supabaseBrowser.auth.getUser()

        if (!user) {
          router.replace("/login?next=/portal")
          return
        }

        router.prefetch("/portal/inbox")

        const res = await fetch("/api/portal/calls?limit=3&unique_callers=1&include_stats=1", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const json = (await res.json().catch(() => null)) as CallsResponse | null
        if (!res.ok) throw new Error((json as any)?.error || "Failed to load portal")

        if (!cancelled) {
          setCalls(json?.data || [])
          setStats(json?.stats || null)
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load portal")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  const recentCount = filteredCalls.length

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-slate-900">Portal</div>
            <div className="text-sm text-slate-500">Quick access to your latest call activity</div>
          </div>

          <Link
            href="/"
            prefetch
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">Recent activity</div>
                <div className="mt-1 text-sm text-slate-600">Only the latest three caller threads show here for speed.</div>
              </div>

              <Link
                href="/portal/inbox"
                prefetch
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                View full call logs
              </Link>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search recent calls</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by number, name, or summary"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-300"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900">This week</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Calls</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{stats?.week?.total ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Missed today</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{stats?.today?.missed ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Live</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{stats?.week?.live ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Voicemail</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{stats?.week?.voicemail ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {loading && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">Loading recent calls...</div>}

        {!loading && err && <div className="rounded-2xl border border-rose-200 bg-white p-4 text-rose-600">{err}</div>}

        {!loading && !err && (
          <div className="grid gap-3">
            {recentCount === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-600">
                {search.trim() ? "No recent calls matched your search." : "No recent calls yet."}
              </div>
            ) : (
              filteredCalls.map((call) => {
                const detailsKey = (call.call_sid && String(call.call_sid).trim()) || call.id
                const summary = clampText(call.ai_summary || call.transcript, 96)
                const outcomeLabel = getDisplayOutcome(call)

                return (
                  <div
                    key={call.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-base font-bold text-slate-900">{formatDisplayNumber(call.caller_number)}</div>
                          {call.caller_name ? (
                            <div className="truncate text-sm text-slate-600">
                              {call.caller_name}
                              {call.name_source === "ai" ? <span className="ml-1 font-bold text-amber-500">!</span> : null}
                            </div>
                          ) : null}
                          {outcomeLabel ? (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeChipClasses(outcomeLabel)}`}>
                              {outcomeLabel}
                            </span>
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
                          href={`tel:${cleanNumber(call.caller_number)}`}
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
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
