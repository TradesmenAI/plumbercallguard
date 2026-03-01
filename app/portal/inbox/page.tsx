"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

type Call = {
  id: string
  from_number: string
  caller_name: string | null
  name_source: "ai" | "manual" | null
  customer_type: "new" | "existing"
  ai_summary: string | null
  created_at: string

  voicemail_left: boolean
  sms_sent: boolean
  answered_live: boolean

  status: "answered" | "sms" | "voicemail"
}

function formatUkNumber(n: string) {
  const s = String(n || "").trim()
  if (!s.startsWith("+44")) return s
  const d = s.replace(/[^\d+]/g, "")
  // +44 7xxx xxx xxx
  if (d.startsWith("+447") && d.length >= 13) {
    const a = d.slice(0, 3) // +44
    const b = d.slice(3, 6) // 7xx
    const c = d.slice(6, 9)
    const e = d.slice(9, 12)
    const f = d.slice(12)
    return `${a} ${b} ${c} ${e}${f ? " " + f : ""}`
  }
  return d
}

function isSameIsoDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function InboxPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<Call[]>([])
  const [err, setErr] = useState<string | null>(null)

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
        const res = await fetch("/api/portal/calls?limit=75")
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || "Failed to load calls")
        setCalls((j.data || []) as Call[])
      } catch (e: any) {
        setErr(e?.message || "Failed to load")
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [router])

  const stats = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - 6) // last 7 days incl today
    start.setHours(0, 0, 0, 0)

    let weekTotal = 0
    let weekAnswered = 0
    let weekSms = 0
    let weekVoicemail = 0

    let todayTotal = 0
    let todayMissed = 0

    for (const c of calls) {
      const dt = new Date(c.created_at)
      const inWeek = dt >= start
      const inToday = isSameIsoDay(dt, now)

      if (inWeek) {
        weekTotal++
        if (c.answered_live) weekAnswered++
        if (c.sms_sent) weekSms++
        if (c.voicemail_left) weekVoicemail++
      }

      if (inToday) {
        todayTotal++
        if (!c.answered_live) todayMissed++
      }
    }

    return {
      weekTotal,
      weekAnswered,
      weekSms,
      weekVoicemail,
      todayTotal,
      todayMissed,
    }
  }, [calls])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
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

        {/* This week card */}
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">This Week</div>
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{stats.weekTotal}</span> calls ·{" "}
                <span className="font-semibold text-slate-900">{stats.weekAnswered}</span> live ·{" "}
                <span className="font-semibold text-slate-900">{stats.weekSms}</span> SMS ·{" "}
                <span className="font-semibold text-slate-900">{stats.weekVoicemail}</span> voicemail
              </div>
              <div className="mt-1 text-xs text-slate-500">instant follow-ups ⚡</div>
            </div>

            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
              Today: <span className="font-semibold text-slate-900">{stats.todayTotal}</span> · Missed:{" "}
              <span className="font-semibold text-slate-900">{stats.todayMissed}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
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

        {/* Body */}
        <div className="mt-5">
          {loading && (
            <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
              Loading…
            </div>
          )}

          {err && (
            <div className="rounded-2xl bg-white p-4 text-red-600 shadow-sm ring-1 ring-slate-200">
              {err}
            </div>
          )}

          {!loading && !err && calls.length === 0 && (
            <div className="rounded-2xl bg-white p-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
              No calls yet.
            </div>
          )}

          <div className="mt-3 space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: icons + number/name */}
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Icons */}
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

                    {/* Text */}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {formatUkNumber(call.from_number)}
                      </div>

                      <div className="truncate text-xs text-slate-600">
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
                        <span className="mx-2 text-slate-300">•</span>
                        <span>{call.customer_type === "new" ? "New" : "Existing"}</span>
                        {call.ai_summary ? (
                          <>
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="text-slate-600">{call.ai_summary}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Right: call button + arrow */}
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

          <div className="mt-6 text-center text-xs text-slate-400">
            Tip: mobile callers get an instant SMS after a voicemail.
          </div>
        </div>
      </div>
    </div>
  )
}