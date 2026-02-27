"use client"

import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
type HoursCfg = { enabled: boolean; start: string; end: string }
type BusinessHours = Record<DayKey, HoursCfg>

type MeData = {
  id: string
  email: string
  plan: "standard" | "pro" | string
  timezone: string | null
  business_hours: any
  tts_voice_gender: "male" | "female" | null
  voicemail_in_tts: string | null
  voicemail_in_audio_path: string | null
  voicemail_out_tts: string | null
  voicemail_out_audio_path: string | null
}

const DEFAULT_HOURS: BusinessHours = {
  mon: { enabled: true, start: "09:00", end: "17:00" },
  tue: { enabled: true, start: "09:00", end: "17:00" },
  wed: { enabled: true, start: "09:00", end: "17:00" },
  thu: { enabled: true, start: "09:00", end: "17:00" },
  fri: { enabled: true, start: "09:00", end: "17:00" },
  sat: { enabled: false, start: "09:00", end: "13:00" },
  sun: { enabled: false, start: "10:00", end: "12:00" },
}

function dayLabel(k: DayKey) {
  const m: Record<DayKey, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" }
  return m[k]
}

function normalizeBusinessHours(v: any): BusinessHours {
  if (!v) return DEFAULT_HOURS
  let obj: any = v
  if (typeof v === "string") {
    try { obj = JSON.parse(v) } catch { return DEFAULT_HOURS }
  }
  const out: any = { ...DEFAULT_HOURS }
  ;(Object.keys(DEFAULT_HOURS) as DayKey[]).forEach((k) => {
    if (obj?.[k]) out[k] = { ...out[k], ...obj[k] }
  })
  return out as BusinessHours
}

export default function PortalVoicemailPage() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<MeData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [gender, setGender] = useState<"male" | "female">("female")
  const [inTts, setInTts] = useState("")
  const [outTts, setOutTts] = useState("")
  const [timezone, setTimezone] = useState("Europe/London")
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS)

  const isPro = (me?.plan || "").toLowerCase() === "pro"

  async function load() {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch("/api/portal/me")
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed to load profile")

      const data = j.data as MeData
      setMe(data)

      setGender((data.tts_voice_gender || "female") as any)
      setInTts(data.voicemail_in_tts || "Please leave a message after the beep.")
      setOutTts(data.voicemail_out_tts || "We are currently closed. Please leave a message and we will call you back.")
      setTimezone(data.timezone || "Europe/London")
      setHours(normalizeBusinessHours(data.business_hours))
    } catch (e: any) {
      setErr(e?.message || "Failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function logout() {
    await supabaseBrowser.auth.signOut()
    window.location.href = "/login"
  }

  async function saveTts() {
    setErr(null); setMsg(null); setSaving(true)
    try {
      const res = await fetch("/api/portal/voicemail/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tts_voice_gender: gender,
          voicemail_in_mode: "tts",
          voicemail_in_tts: inTts,
          voicemail_out_mode: "tts",
          voicemail_out_tts: outTts,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed to save")
      setMsg("Saved TTS ✅")
      await load()
    } catch (e: any) {
      setErr(e?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function saveSchedule() {
    setErr(null); setMsg(null); setSaving(true)
    try {
      const res = await fetch("/api/portal/voicemail/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, business_hours: hours }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed to save schedule")
      setMsg(isPro ? "Saved schedule ✅" : "Saved schedule (Pro uses it) ✅")
      await load()
    } catch (e: any) {
      setErr(e?.message || "Schedule save failed")
    } finally {
      setSaving(false)
    }
  }

  async function upload(type: "in" | "out", file: File) {
    setErr(null); setMsg(null); setSaving(true)
    try {
      const fd = new FormData()
      fd.append("type", type)
      fd.append("file", file)

      const res = await fetch("/api/portal/voicemail/upload", { method: "POST", body: fd })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Upload failed")

      setMsg(type === "in" ? "Uploaded in-hours MP3 ✅" : "Uploaded out-of-hours MP3 ✅")
      await load()
    } catch (e: any) {
      setErr(e?.message || "Upload failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</div>
  if (!me) return <div style={{ padding: 24, fontFamily: "system-ui", color: "salmon" }}>{err || "No data"}</div>

  return (
    <div style={{ maxWidth: 980, margin: "50px auto", padding: 20, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>PlumberCallGuard Portal</h1>
          <div style={{ opacity: 0.85 }}>
            Logged in as <b>{me.email}</b> • Plan: <b>{me.plan}</b>
          </div>
        </div>
        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 10 }}>
          Sign out
        </button>
      </div>

      <div style={{ marginTop: 22, padding: 16, border: "1px solid #2a2a2a", borderRadius: 14, background: "#0b0b0b" }}>
        <h2 style={{ marginTop: 0 }}>Voicemail</h2>
        <div style={{ opacity: 0.85 }}>Upload MP3 to use your own voicemail (overrides TTS).</div>

        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6, maxWidth: 260 }}>
            <b>Voice</b>
            <select value={gender} onChange={(e) => setGender(e.target.value as any)} style={{ padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff" }}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <b>In-hours TTS message</b>
            <textarea value={inTts} onChange={(e) => setInTts(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff" }} />
            <div style={{ opacity: 0.75 }}>Current in-hours MP3: <code>{me.voicemail_in_audio_path || "none"}</code></div>
            <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4" disabled={saving} onChange={(e) => e.target.files?.[0] && upload("in", e.target.files[0])} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <b>Out-of-hours TTS message</b>
            <textarea value={outTts} onChange={(e) => setOutTts(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff" }} />
            <div style={{ opacity: 0.75 }}>Current out-of-hours MP3: <code>{me.voicemail_out_audio_path || "none"}</code></div>

            {isPro ? (
              <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4" disabled={saving} onChange={(e) => e.target.files?.[0] && upload("out", e.target.files[0])} />
            ) : (
              <div style={{ opacity: 0.8 }}>Pro only: separate out-of-hours MP3 + schedule switching.</div>
            )}
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={saveTts} disabled={saving} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #333", background: saving ? "#222" : "#0f2a5a", color: "#fff" }}>
              {saving ? "Saving…" : "Save TTS"}
            </button>
            {msg && <div style={{ color: "lime" }}>{msg}</div>}
            {err && <div style={{ color: "salmon" }}>{err}</div>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #2a2a2a", borderRadius: 14, background: "#0b0b0b" }}>
        <h2 style={{ marginTop: 0 }}>Business hours schedule</h2>
        <div style={{ opacity: 0.85 }}>
          Pro users switch between in-hours and out-of-hours based on this schedule. Standard users always use in-hours.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <b style={{ width: 90 }}>Timezone</b>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", width: 260 }} />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            {(Object.keys(hours) as DayKey[]).map((k) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "60px 110px 140px 140px", gap: 10, alignItems: "center" }}>
                <b>{dayLabel(k)}</b>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={hours[k].enabled}
                    onChange={(e) => setHours((prev) => ({ ...prev, [k]: { ...prev[k], enabled: e.target.checked } }))}
                  />
                  <span>Open</span>
                </label>
                <input
                  type="time"
                  value={hours[k].start}
                  onChange={(e) => setHours((prev) => ({ ...prev, [k]: { ...prev[k], start: e.target.value } }))}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff" }}
                />
                <input
                  type="time"
                  value={hours[k].end}
                  onChange={(e) => setHours((prev) => ({ ...prev, [k]: { ...prev[k], end: e.target.value } }))}
                  style={{ padding: 8, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff" }}
                />
              </div>
            ))}
          </div>

          <button onClick={saveSchedule} disabled={saving} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #333", background: saving ? "#222" : "#0f2a5a", color: "#fff", width: 180 }}>
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}