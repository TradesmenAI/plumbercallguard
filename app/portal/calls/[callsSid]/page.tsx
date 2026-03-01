"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

type CallRow = {
  id: string
  call_sid: string
  caller_number: string | null
  inbound_to: string | null

  recording_url: string | null
  recording_duration: number | null

  ai_summary: string | null
  transcript: string | null

  sms_sent: boolean | null
  voicemail_left: boolean | null
  answered_live: boolean | null

  created_at: string | null
}

type ApiResponse = {
  data?: CallRow
  error?: string
}

function stripSpaces(s: string) {
  return String(s || "").replace(/\s+/g, "")
}

export default function CallDetailsPage() {
  const router = useRouter()
  const params = useParams()

  const callSid = useMemo(() => {
    const raw = (params as any)?.callSid
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : ""
  }, [params])

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<CallRow | null>(null)

  useEffect(() => {
    let mounted = true

    async function run() {
      setErr(null)
      setLoading(true)

      try {
        if (!callSid) throw new Error("Missing callSid")

        const res = await fetch(`/api/portal/calls/${encodeURIComponent(callSid)}`, {
          cache: "no-store",
        })
        const json = (await res.json().catch(() => null)) as ApiResponse | null
        if (!res.ok) throw new Error(json?.error || "Failed to load call")

        if (!mounted) return
        setData(json?.data || null)
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
  }, [callSid])

  const caller = stripSpaces(data?.caller_number || "")
  const hasRecording = !!data?.recording_url

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Call Log</h1>
            <div className="text-sm text-slate-500">{callSid ? `SID: ${callSid}` : ""}</div>
          </div>

          <button
            onClick={() => router.push("/portal/inbox")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-slate-700">
            Loading…
          </div>
        )}

        {!loading && err && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && data && (
          <div className="space-y-4">
            {/* Top actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">Caller</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900">
                    {caller || "Unknown"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {data.created_at ? `Created: ${data.created_at}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={caller ? `tel:${caller}` : "#"}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-extrabold text-white shadow-sm ${
                      caller ? "bg-lime-600 hover:bg-lime-700" : "bg-slate-300 cursor-not-allowed"
                    }`}
                    onClick={(e) => {
                      if (!caller) e.preventDefault()
                    }}
                  >
                    📞 Call
                  </a>

                  <a
                    href={caller ? `sms:${caller}` : "#"}
                    className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 ${
                      caller ? "" : "opacity-50 cursor-not-allowed pointer-events-none"
                    }`}
                    title="Open SMS app"
                  >
                    ✉️ SMS
                  </a>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                {data.answered_live ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                    ✓ Answered live
                  </span>
                ) : null}

                {data.sms_sent ? (
                  <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-fuchsia-800">
                    ✉️ SMS sent
                  </span>
                ) : null}

                {data.voicemail_left ? (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">
                    🎙️ Voicemail left
                  </span>
                ) : null}
              </div>
            </div>

            {/* Recording */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Voicemail</div>

              {hasRecording ? (
                <div className="mt-3">
                  <audio controls preload="none" className="w-full">
                    <source src={data.recording_url || ""} />
                  </audio>
                  <div className="mt-2 text-xs text-slate-500">
                    {typeof data.recording_duration === "number"
                      ? `Duration: ${data.recording_duration}s`
                      : ""}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">No recording URL on this call.</div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Summary</div>
              <div className="mt-2 text-sm text-slate-700">
                {data.ai_summary?.trim() || "No summary yet."}
              </div>
            </div>

            {/* Transcript */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Transcript</div>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {data.transcript?.trim() || "No transcript yet."}
              </pre>
            </div>

            {/* Raw */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">Raw</div>
              <div className="mt-2 grid gap-2 text-sm text-slate-700">
                <div>
                  <span className="text-slate-500">Inbound to:</span> {data.inbound_to || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Recording URL:</span>{" "}
                  {data.recording_url ? (
                    <a className="text-blue-700 underline" href={data.recording_url} target="_blank">
                      open
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !err && !data && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-slate-700">
            Not found.
          </div>
        )}
      </div>
    </div>
  )
}