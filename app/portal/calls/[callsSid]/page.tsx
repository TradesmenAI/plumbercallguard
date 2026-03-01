"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import AudioPlayer from "./AudioPlayer"

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

  caller_name: string | null
  name_source: "ai" | "manual" | null

  created_at: string | null
  caller_type: string | null
}

function cleanNumber(n: string | null | undefined) {
  return String(n || "").replace(/\s+/g, "")
}

function firstStr(v: unknown) {
  if (!v) return ""
  if (Array.isArray(v)) return String(v[0] || "")
  return String(v)
}

export default function CallDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const search = useSearchParams()
  const pathname = usePathname()

  // Robust SID lookup:
  // 1) route param (folder [callsSid])
  // 2) query param ?sid=
  // 3) last URL segment (/portal/calls/<SID>)
  const callsSidStr = useMemo(() => {
    const fromParams =
      firstStr((params as any)?.callsSid) ||
      firstStr((params as any)?.callSid) ||
      firstStr((params as any)?.callsid) ||
      firstStr((params as any)?.calls_id)

    if (fromParams) return fromParams

    const fromQuery = search?.get("sid") || search?.get("callSid") || ""
    if (fromQuery) return fromQuery

    const seg = String(pathname || "").split("/").filter(Boolean)
    const last = seg[seg.length - 1] || ""
    return last
  }, [params, search, pathname])

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<CallRow | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setErr(null)
      setLoading(true)

      try {
        if (!callsSidStr) throw new Error("Missing callSid")

        const res = await fetch(`/api/portal/calls/${encodeURIComponent(callsSidStr)}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const j = await res.json().catch(() => null)
        if (!res.ok) throw new Error(j?.error || "Failed to load call")

        if (!cancelled) setData(j.data as CallRow)
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
  }, [callsSidStr])

  const number = cleanNumber(data?.caller_number)
  const smsHref = number ? `sms:${number}` : undefined
  const audioSrc = callsSidStr ? `/api/portal/calls/${encodeURIComponent(callsSidStr)}/audio` : ""

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">Call Log</div>
            <div className="text-sm text-slate-500">Full details for this call</div>
          </div>

          <button
            onClick={() => router.push("/portal/inbox")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">Loading...</div>
        )}

        {!loading && err && (
          <div className="rounded-2xl border border-rose-200 bg-white p-4 text-rose-600">{err}</div>
        )}

        {!loading && !err && data && (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">{number || "Unknown number"}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {data.caller_name ? (
                      <span className="font-semibold text-slate-900">
                        {data.caller_name}
                        {data.name_source === "ai" ? <span className="ml-1 text-amber-500">!</span> : null}
                      </span>
                    ) : (
                      "No name"
                    )}
                    <span className="mx-2 text-slate-300">•</span>
                    {data.created_at ? new Date(data.created_at).toLocaleString() : "Unknown time"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={number ? `tel:${number}` : undefined}
                    onClick={(e) => {
                      if (!number) e.preventDefault()
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${
                      number ? "bg-lime-600 hover:bg-lime-700" : "bg-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <span>📞</span> Call
                  </a>

                  <a
                    href={smsHref}
                    onClick={(e) => {
                      if (!smsHref) e.preventDefault()
                    }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold shadow-sm ${
                      smsHref
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <span>💬</span> SMS
                  </a>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {data.answered_live ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                    ✅ Answered live
                  </span>
                ) : null}

                {data.sms_sent ? (
                  <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700">
                    ✉️ SMS sent
                  </span>
                ) : null}

                {data.voicemail_left ? (
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                    🎙️ Voicemail left
                  </span>
                ) : null}

                {data.caller_type ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                    {data.caller_type}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Voicemail</div>

              {data.recording_url ? (
                <div className="grid gap-3">
                  <AudioPlayer src={audioSrc} />
                  <div className="text-xs text-slate-500 break-all">
                    Recording URL: <span className="text-slate-700">{data.recording_url}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No recording for this call.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Summary</div>
              <div className="text-sm text-slate-700">{data.ai_summary ? data.ai_summary : "No summary yet."}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Transcript</div>
              <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {data.transcript ? data.transcript : "No transcript yet."}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Details</div>
              <div className="grid gap-2 text-sm text-slate-700">
                <div>
                  <span className="text-slate-500">Call SID:</span> {data.call_sid}
                </div>
                <div>
                  <span className="text-slate-500">Inbound to:</span> {cleanNumber(data.inbound_to) || "—"}
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{" "}
                  {data.recording_duration != null ? `${data.recording_duration}s` : "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}