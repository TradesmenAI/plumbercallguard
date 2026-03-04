"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"

type CallRow = {
  id: string
  call_sid: string | null
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

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "0:00"
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, "0")}`
}

export default function CallDetailsPage() {
  const router = useRouter()
  const params = useParams()

  // route folder is [callsSid] so param is params.callsSid
  const callsSidStr = useMemo(() => {
    const raw = (params as any)?.callsSid
    if (!raw) return ""
    if (Array.isArray(raw)) return String(raw[0] || "")
    return String(raw)
  }, [params])

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<CallRow | null>(null)

  // Audio state (safe TS)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)

  // local-only edit contact
  const [editOpen, setEditOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [notesDraft, setNotesDraft] = useState("")
  const [savingLocal, setSavingLocal] = useState(false)

  const number = cleanNumber(data?.caller_number)
  const smsHref = number ? `sms:${number}` : undefined

  // IMPORTANT: page URL uses call_sid currently (like CAxxxx). Your API supports id OR call_sid.
  const audioSrc = callsSidStr ? `/api/portal/calls/${encodeURIComponent(callsSidStr)}/audio` : ""

  const durationLabel = useMemo(() => {
    // prefer DB duration immediately; if audio metadata later, we show the updated one
    const db = data?.recording_duration ?? null
    return formatDuration(duration ?? db)
  }, [duration, data?.recording_duration])

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

        if (!cancelled) {
          setData(j.data as CallRow)

          // seed local-only contact info
          const caller = cleanNumber((j.data as CallRow)?.caller_number)
          if (caller) {
            const storedName = localStorage.getItem(`pcg_contact_name_${caller}`) || ""
            const storedNotes = localStorage.getItem(`pcg_contact_notes_${caller}`) || ""
            setNameDraft(storedName || (j.data as CallRow)?.caller_name || "")
            setNotesDraft(storedNotes || "")
          } else {
            setNameDraft((j.data as CallRow)?.caller_name || "")
            setNotesDraft("")
          }
        }
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

  // Audio listeners (NO “a is possibly null”)
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onLoadedMetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    }
    const onTimeUpdate = () => setCurrentTime(el.currentTime || 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    el.addEventListener("loadedmetadata", onLoadedMetadata)
    el.addEventListener("timeupdate", onTimeUpdate)
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onEnded)

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata)
      el.removeEventListener("timeupdate", onTimeUpdate)
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onEnded)
    }
  }, [audioSrc])

  async function togglePlay() {
    const el = audioRef.current
    if (!el) return

    try {
      if (el.paused) {
        await el.play()
      } else {
        el.pause()
      }
    } catch {
      // ignore autoplay restrictions etc
    }
  }

  function onSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current
    if (!el) return
    const next = Number(e.target.value)
    if (!Number.isFinite(next)) return
    el.currentTime = next
    setCurrentTime(next)
  }

  async function saveLocalContact() {
    setSavingLocal(true)
    try {
      const caller = cleanNumber(data?.caller_number)
      if (caller) {
        localStorage.setItem(`pcg_contact_name_${caller}`, nameDraft.trim())
        localStorage.setItem(`pcg_contact_notes_${caller}`, notesDraft)
      }
      setEditOpen(false)
    } finally {
      setSavingLocal(false)
    }
  }

  const showAiBang = data?.caller_name && data?.name_source === "ai"

  const maxSeek = useMemo(() => {
    // if metadata loaded, use it, otherwise use DB duration, otherwise 0
    return Math.max(0, Math.floor(duration ?? data?.recording_duration ?? 0))
  }, [duration, data?.recording_duration])

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
            {/* Top actions card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">{number || "Unknown number"}</div>

                  <div className="mt-1 text-sm text-slate-600">
                    {data.caller_name ? (
                      <span className="font-semibold text-slate-900">
                        {data.caller_name}
                        {showAiBang ? <span className="ml-1 text-amber-500">!</span> : null}
                      </span>
                    ) : (
                      "No name"
                    )}
                    <span className="mx-2 text-slate-300">•</span>
                    {data.created_at ? new Date(data.created_at).toLocaleString() : "Unknown time"}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
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

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    ✏️ Edit contact
                  </button>

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
            </div>

            {/* Voicemail / audio */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">Voicemail</div>
                <div className="text-xs text-slate-500">Duration: {durationLabel}</div>
              </div>

              {data.recording_url ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lime-600 text-white shadow-sm hover:bg-lime-700"
                      aria-label={isPlaying ? "Pause" : "Play"}
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? "⏸" : "▶"}
                    </button>

                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={maxSeek}
                        value={Math.min(currentTime, maxSeek)}
                        onChange={onSeek}
                        className="w-full"
                        disabled={maxSeek <= 0}
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{formatDuration(currentTime)}</span>
                        <span>{maxSeek > 0 ? durationLabel : "Loading..."}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 break-all">
                    Recording URL: <span className="text-slate-700">{data.recording_url}</span>
                  </div>

                  <audio ref={audioRef} src={audioSrc} preload="metadata" />
                </div>
              ) : (
                <div className="text-sm text-slate-500">No recording for this call.</div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Summary</div>
              <div className="text-sm text-slate-700">{data.ai_summary ? data.ai_summary : "No summary yet."}</div>
            </div>

            {/* Transcript */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 text-sm font-bold text-slate-900">Transcript</div>
              <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {data.transcript ? data.transcript : "No transcript yet."}
              </pre>
            </div>
          </div>
        )}

        {/* Edit contact modal (local only) */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-900">Edit contact</div>
                  <div className="text-sm text-slate-500">This is saved locally for now.</div>
                </div>
                <button
                  onClick={() => setEditOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Customer name</label>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. John Smith"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Tip: if AI guessed it wrong, overwrite it here.
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Notes</label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="mt-1 min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Add notes about this customer / job..."
                  />
                  <div className="mt-1 text-xs text-slate-500">Notes are saved locally for now.</div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveLocalContact}
                    disabled={savingLocal}
                    className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${
                      savingLocal ? "bg-slate-400 cursor-not-allowed" : "bg-lime-600 hover:bg-lime-700"
                    }`}
                  >
                    {savingLocal ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}