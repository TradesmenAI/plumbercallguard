"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type InboxCall = {
  id: string
  from_number: string
  caller_name: string | null
  name_source: "ai" | "manual" | null
  customer_type: "new" | "existing" | string
  status: "answered" | "sms" | "voicemail"
  ai_summary: string | null
  created_at: string
}

function statusIcon(status: InboxCall["status"]) {
  if (status === "answered") return "✅"
  if (status === "sms") return "✉️"
  return "🎙️"
}

export default function PortalInboxPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<InboxCall[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setErr(null)

      // Server cookie auth is source of truth
      const meRes = await fetch("/api/portal/me")
      if (meRes.status === 401) {
        router.replace("/login?next=/portal/inbox")
        return
      }

      try {
        const res = await fetch("/api/portal/calls?limit=50")
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || "Failed to load calls")
        setCalls((j.data || []) as InboxCall[])
      } catch (e: any) {
        setErr(e?.message || "Failed to load")
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-[#1E293B]">Inbox</h1>
        <button onClick={() => router.push("/portal")} className="text-sm text-gray-500 hover:text-gray-800">
          Back
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200">
        <div className="text-sm text-gray-700 flex flex-wrap gap-4">
          <span>✅ Answered</span>
          <span>✉️ Contacted via SMS</span>
          <span>🎙️ Voicemail left</span>
          <span className="text-yellow-600 font-semibold">! AI name</span>
        </div>
      </div>

      {loading && <div className="p-2 text-gray-600">Loading…</div>}
      {err && <div className="p-2 text-red-600">{err}</div>}

      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between border border-gray-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-lg">{statusIcon(call.status)}</div>

              <div className="min-w-0">
                <div className="font-semibold text-[#1E293B] truncate">
                  {call.from_number}
                  {call.name_source === "ai" && (
                    <span title="Name detected automatically from transcript" className="ml-2 text-yellow-600 font-bold">
                      !
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-500 truncate">
                  {call.caller_name || "No name"} ·{" "}
                  {String(call.customer_type || "new").toLowerCase() === "existing" ? "Existing" : "New"}
                  {call.ai_summary ? ` · ${call.ai_summary}` : ""}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${call.from_number}`}
                className="bg-lime-500 text-white px-3 py-2 rounded-lg font-semibold text-sm"
              >
                Call
              </a>

              <button
                onClick={() => router.push(`/portal/calls/${encodeURIComponent(call.id)}`)}
                className="text-gray-500 text-xl px-2"
                aria-label="Open details"
              >
                →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}