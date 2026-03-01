"use client"

import { useEffect, useState } from "react"
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

  // NEW: multi-icon flags
  voicemail_left: boolean
  sms_sent: boolean
  answered_live: boolean

  // legacy
  status: "answered" | "sms" | "voicemail"
}

export default function InboxPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState<Call[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setErr(null)

      // Ensure user is logged in (client session)
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      if (!user) {
        router.replace("/login?next=/portal/inbox")
        return
      }

      try {
        const res = await fetch("/api/portal/calls?limit=50")
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

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Inbox</h1>
        <button onClick={() => router.push("/portal")} className="text-gray-500 hover:underline">
          Back
        </button>
      </div>

      {/* Legend */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="flex items-center gap-2">
            <span className="text-green-600">✅</span> Answered
          </span>
          <span className="flex items-center gap-2">
            <span className="text-purple-600">✉️</span> Contacted via SMS
          </span>
          <span className="flex items-center gap-2">
            <span className="text-blue-600">🎙️</span> Voicemail left
          </span>
          <span className="flex items-center gap-2">
            <span className="text-yellow-600 font-bold">!</span> AI name
          </span>
        </div>
      </div>

      {loading && <div className="mt-6">Loading...</div>}
      {err && <div className="mt-6 text-red-600">{err}</div>}

      <div className="mt-6 space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between"
          >
            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0">
              {/* MULTI ICONS */}
              <div className="flex items-center gap-2 w-[86px] shrink-0">
                {call.answered_live && <span className="text-green-600" title="Answered">✅</span>}
                {call.sms_sent && <span className="text-purple-600" title="SMS sent">✉️</span>}
                {call.voicemail_left && <span className="text-blue-600" title="Voicemail left">🎙️</span>}
              </div>

              {/* NUMBER + NAME */}
              <div className="min-w-0">
                <div className="font-semibold text-[#1E293B] truncate">
                  {call.from_number}
                  {call.name_source === "ai" && (
                    <span
                      title="Name detected automatically from transcript"
                      className="ml-2 text-yellow-600 font-bold"
                    >
                      !
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-500 truncate">
                  {(call.caller_name || "No name") + " · " + (call.customer_type === "new" ? "New" : "Existing")}
                  {call.ai_summary ? ` · ${call.ai_summary}` : ""}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2 shrink-0">
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