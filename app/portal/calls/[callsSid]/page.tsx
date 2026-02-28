"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CallDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const callSid = String((params as any)?.callSid || "")

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setErr(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace(`/login?next=/portal/calls/${encodeURIComponent(callSid)}`)
        return
      }

      try {
        const res = await fetch(`/api/portal/calls/${encodeURIComponent(callSid)}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error || "Failed to load call")
        setData(j.data)
      } catch (e: any) {
        setErr(e?.message || "Failed")
      } finally {
        setLoading(false)
      }
    }

    if (callSid) run()
  }, [callSid, router])

  if (loading) return <div className="min-h-screen bg-white p-4">Loading…</div>

  if (err) {
    return (
      <div className="min-h-screen bg-white p-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 mb-3">
          ← Back
        </button>
        <div className="text-red-600">{err}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500">
          ← Back
        </button>

        <a
          href={`tel:${data?.caller_number || ""}`}
          className="bg-lime-500 text-white px-3 py-2 rounded-lg font-semibold text-sm"
        >
          Call
        </a>
      </div>

      <h1 className="text-xl font-bold text-[#1E293B] mb-2">Call details</h1>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500">From:</span>{" "}
          <span className="font-semibold">{data?.caller_number || "—"}</span>
        </div>

        <div>
          <span className="text-gray-500">Created:</span> {data?.created_at || "—"}
        </div>

        <div>
          <span className="text-gray-500">Summary:</span> {data?.ai_summary || ""}
        </div>

        <div>
          <span className="text-gray-500">Transcript:</span>
          <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 whitespace-pre-wrap">
            {data?.transcript || ""}
          </pre>
        </div>

        <div>
          <span className="text-gray-500">Recording URL:</span> {data?.recording_url || "—"}
        </div>
      </div>
    </div>
  )
}