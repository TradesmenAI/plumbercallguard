import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import AudioPlayer from "./AudioPlayer"

export const runtime = "nodejs"

type CallDetail = {
  id: string
  call_sid: string
  user_id: string | null
  caller_number: string | null
  caller_type: string | null
  inbound_to: string | null
  call_status: string | null
  sms_sent: boolean | null
  answered_live: boolean | null
  recording_url: string | null
  recording_duration: number | null
  ai_summary: string | null
  transcript: string | null
  caller_name: string | null
  name_source: "ai" | "manual" | null
  created_at: string | null
}

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const VOICEMAIL_SECONDS_THRESHOLD = 3

function cleanNumber(n: string | null | undefined) {
  return String(n || "")
    .trim()
    .replace(/[^\d+]/g, "")
}

function niceTime(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function voicemailLeft(row: CallDetail) {
  const dur = Number(row.recording_duration || 0)
  return !!row.recording_url && dur >= VOICEMAIL_SECONDS_THRESHOLD
}

export default async function CallDetailsPage({
  params,
}: {
  params: Promise<{ callSid: string }>
}) {
  const { callSid } = await params
  const sid = String(callSid || "").trim()

  if (!sid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="rounded-2xl bg-white p-4 text-red-600 shadow-sm ring-1 ring-slate-200">
            Missing callSid
          </div>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Server Components can’t persist cookies here; middleware handles refresh.
          // This is fine for reads.
          cookiesToSet.forEach(() => {})
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/portal/calls/${encodeURIComponent(sid)}`)
  }

  const { data, error } = await admin
    .from("calls")
    .select(
      [
        "id",
        "call_sid",
        "user_id",
        "caller_number",
        "caller_type",
        "inbound_to",
        "call_status",
        "sms_sent",
        "answered_live",
        "recording_url",
        "recording_duration",
        "ai_summary",
        "transcript",
        "caller_name",
        "name_source",
        "created_at",
      ].join(",")
    )
    .eq("user_id", user.id)
    .eq("call_sid", sid)
    .single<CallDetail>()

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Call Log</h1>
              <p className="text-sm text-slate-500">{sid}</p>
            </div>
            <a
              href="/portal/inbox"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back
            </a>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-4 text-red-600 shadow-sm ring-1 ring-slate-200">
            Not found (or not yours)
          </div>
        </div>
      </div>
    )
  }

  const from = cleanNumber(data.caller_number)
  const canCall = !!from
  const canSms = !!from
  const hasRecording = !!data.recording_url

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Call Log</h1>
            <p className="text-sm text-slate-500">{from || sid}</p>
          </div>

          <a
            href="/portal/inbox"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </a>
        </div>

        <div className="mt-4 space-y-3">
          {/* Actions */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">
                  {data.caller_name ? (
                    <>
                      {data.caller_name}
                      {data.name_source === "ai" && (
                        <span
                          className="ml-1 font-bold text-amber-600"
                          title="AI-detected name (not guaranteed)"
                        >
                          !
                        </span>
                      )}
                    </>
                  ) : (
                    "No name"
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Created: <span className="text-slate-700">{niceTime(data.created_at)}</span>
                  {data.inbound_to ? (
                    <>
                      <span className="mx-2 text-slate-300">•</span>
                      To: <span className="text-slate-700">{cleanNumber(data.inbound_to)}</span>
                    </>
                  ) : null}
                  {data.caller_type ? (
                    <>
                      <span className="mx-2 text-slate-300">•</span>
                      Type: <span className="text-slate-700">{data.caller_type}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={canCall ? `tel:${from}` : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${
                    canCall ? "bg-lime-600 hover:bg-lime-700" : "bg-slate-300 cursor-not-allowed"
                  }`}
                  aria-disabled={!canCall}
                >
                  📞 Call
                </a>

                <a
                  href={canSms ? `sms:${from}` : undefined}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${
                    canSms
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed"
                  }`}
                  aria-disabled={!canSms}
                >
                  ✉ SMS
                </a>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {data.answered_live ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  ✓ Answered live
                </span>
              ) : null}

              {data.sms_sent ? (
                <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700 ring-1 ring-purple-200">
                  ✉ SMS sent
                </span>
              ) : null}

              {voicemailLeft(data) ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 ring-1 ring-blue-200">
                  🎙 Voicemail left
                </span>
              ) : null}

              {data.call_status ? (
                <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  Status: {data.call_status}
                </span>
              ) : null}
            </div>
          </div>

          {/* Voicemail */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Voicemail</h2>

            {!hasRecording ? (
              <div className="mt-2 text-sm text-slate-600">No recording found for this call.</div>
            ) : (
              <div className="mt-3">
                <AudioPlayer src={data.recording_url!} />
                <div className="mt-2 text-xs text-slate-500">
                  Duration: <span className="text-slate-700">{data.recording_duration ?? "—"}</span>s
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Summary</h2>
            <div className="mt-2 text-sm text-slate-700">{data.ai_summary || "No summary yet."}</div>
          </div>

          {/* Transcript */}
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Transcript</h2>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-800 ring-1 ring-slate-200">
              {data.transcript || "No transcript yet."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}