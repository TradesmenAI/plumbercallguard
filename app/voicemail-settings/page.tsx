"use client"

import React, { useEffect, useMemo, useState } from "react"

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
type HoursCfg = { enabled: boolean; start: string; end: string }
type BusinessHours = Record<DayKey, HoursCfg>

type UserSettings = {
  id: string
  plan: string
  timezone: string
  business_hours: BusinessHours | null

  tts_voice_gender: "male" | "female"

  voicemail_in_mode: "tts" | "audio"
  voicemail_in_tts: string | null
  voicemail_in_audio_path: string | null

  voicemail_out_mode: "tts" | "audio"
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
  const m: Record<DayKey, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  }
  return m[k]
}

export default function VoicemailSettingsPage() {
  const [userId, setUserId] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [settings, setSettings] = useState<UserSettings | null>(null)

  const isPro = useMemo(() => (settings ? String(settings.plan).toLowerCase() === "pro" : false), [settings])

  // local editable state (so UI is responsive)
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female")

  const [inMode, setInMode] = useState<"tts" | "audio">("tts")
  const [inTts, setInTts] = useState("Please leave a message after the beep.")

  const [outMode, setOutMode] = useState<"tts" | "audio">("tts")
  const [outTts, setOutTts] = useState("We are currently closed. Please leave a message and we will call you back.")

  const [timezone, setTimezone] = useState("Europe/London")
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_HOURS)

  // load from query string if present
  useEffect(() => {
    const u = new URL(window.location.href)
    const qUserId = u.searchParams.get("userId")
    const qToken = u.searchParams.get("token")
    if (qUserId) setUserId(qUserId)
    if (qToken) setToken(qToken)
  }, [])

  async function loadSettings() {
    setErr(null)
    setMsg(null)
    if (!userId || !token) {
      setErr("Enter userId and token first.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/public/user-settings?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load settings")

      const s: UserSettings = json.data
      setSettings(s)

      setVoiceGender((s.tts_voice_gender || "female") as any)

      setInMode((s.voicemail_in_mode || "tts") as any)
      setInTts(s.voicemail_in_tts || "Please leave a message after the beep.")

      setOutMode((s.voicemail_out_mode || "tts") as any)
      setOutTts(s.voicemail_out_tts || "We are currently closed. Please leave a message and we will call you back.")

      setTimezone(s.timezone || "Europe/London")
      setHours(s.business_hours || DEFAULT_HOURS)

      setMsg("Loaded.")
    } catch (e: any) {
      setErr(e.message || "Failed")
    } finally {
      setLoading(false)
    }
  }

  async function saveVoiceAndTts() {
    if (!userId || !token) return setErr("Enter userId and token first.")
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      // 1) save gender
      {
        const res = await fetch("/api/public/voicemail/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, token, tts_voice_gender: voiceGender }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to save voice gender")
      }

      // 2) save in-hours settings
      {
        const res = await fetch("/api/public/voicemail/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            token,
            type: "in",
            mode: inMode,
            ttsText: inMode === "tts" ? inTts : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to save in-hours settings")
      }

      // 3) save out-of-hours settings (allowed for all, but only used by Pro switching)
      {
        const res = await fetch("/api/public/voicemail/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            token,
            type: "out",
            mode: outMode,
            ttsText: outMode === "tts" ? outTts : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to save out-of-hours settings")
      }

      setMsg("Saved voice + TTS settings.")
      await loadSettings()
    } catch (e: any) {
      setErr(e.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  async function saveHours() {
    if (!userId || !token) return setErr("Enter userId and token first.")
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/public/voicemail/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token, timezone, business_hours: hours }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to save schedule")

      setMsg(isPro ? "Saved schedule (Pro switching will use it)." : "Saved schedule (only Pro switching uses it).")
      await loadSettings()
    } catch (e: any) {
      setErr(e.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  async function uploadMp3(type: "in" | "out", file: File) {
    if (!userId || !token) return setErr("Enter userId and token first.")
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append("userId", userId)
      fd.append("token", token)
      fd.append("type", type)
      fd.append("file", file)

      const res = await fetch("/api/public/upload-voicemail", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Upload failed")

      setMsg(type === "in" ? "Uploaded in-hours MP3." : "Uploaded out-of-hours MP3.")
      await loadSettings()
    } catch (e: any) {
      setErr(e.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Voicemail Settings</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Temporary admin page (no portal yet). Use <code>?userId=...&token=...</code> or paste below.
      </p>

      <div style={{ display: "grid", gap: 12, padding: 14, border: "1px solid #333", borderRadius: 12, marginBottom: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>User ID</span>
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="UUID" style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Voicemail Token</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="UUID token" style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }} />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={loadSettings} disabled={loading} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #444", background: "#1b1b1b", color: "#fff", cursor: "pointer" }}>
            {loading ? "Loading..." : "Load"}
          </button>
          {settings && (
            <span style={{ opacity: 0.85 }}>
              Plan: <b>{settings.plan}</b>
            </span>
          )}
        </div>

        {msg && <div style={{ padding: 10, borderRadius: 10, background: "#0b2a12", border: "1px solid #1f6b35" }}>{msg}</div>}
        {err && <div style={{ padding: 10, borderRadius: 10, background: "#2a0b0b", border: "1px solid #6b1f1f" }}>{err}</div>}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        {/* Voice */}
        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>TTS Voice (Emma / Brian Neural)</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Gender</span>
              <select value={voiceGender} onChange={(e) => setVoiceGender(e.target.value as any)} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}>
                <option value="female">Female (Emma Neural)</option>
                <option value="male">Male (Brian Neural)</option>
              </select>
            </label>
          </div>
          <p style={{ opacity: 0.8 }}>
            This only affects voicemail when mode is <b>TTS</b>. If you’re using MP3 audio, the MP3 plays.
          </p>
        </section>

        {/* In-hours */}
        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>In-hours Greeting</h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Mode</span>
              <select value={inMode} onChange={(e) => setInMode(e.target.value as any)} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}>
                <option value="tts">TTS (Emma/Brian)</option>
                <option value="audio">Own voicemail (MP3)</option>
              </select>
            </label>

            {inMode === "audio" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Upload MP3</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadMp3("in", f)
                  }}
                />
              </label>
            )}
          </div>

          {inMode === "tts" && (
            <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
              <span>TTS Text</span>
              <textarea value={inTts} onChange={(e) => setInTts(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }} />
            </label>
          )}

          <div style={{ marginTop: 10, opacity: 0.85 }}>
            Current audio path: <code>{settings?.voicemail_in_audio_path || "null"}</code>
          </div>
        </section>

        {/* Out-of-hours */}
        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Out-of-hours Greeting (Pro uses this when closed)</h2>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Mode</span>
              <select value={outMode} onChange={(e) => setOutMode(e.target.value as any)} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}>
                <option value="tts">TTS (Emma/Brian)</option>
                <option value="audio">Own voicemail (MP3)</option>
              </select>
            </label>

            {outMode === "audio" && (
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span>Upload MP3</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadMp3("out", f)
                  }}
                />
              </label>
            )}
          </div>

          {outMode === "tts" && (
            <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
              <span>TTS Text</span>
              <textarea value={outTts} onChange={(e) => setOutTts(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }} />
            </label>
          )}

          <div style={{ marginTop: 10, opacity: 0.85 }}>
            Current audio path: <code>{settings?.voicemail_out_audio_path || "null"}</code>
          </div>

          {!isPro && (
            <p style={{ opacity: 0.8, marginTop: 10 }}>
              You’re on <b>standard</b>. You’ll always use in-hours greeting, even at night/weekends. Pro switching uses the schedule below.
            </p>
          )}
        </section>

        {/* Schedule */}
        <section style={{ padding: 14, border: "1px solid #333", borderRadius: 12 }}>
          <h2 style={{ marginTop: 0 }}>Business Hours Schedule (Pro switching)</h2>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span>Timezone</span>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ padding: 10, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff", width: 240 }} />
            <span style={{ opacity: 0.7 }}>(default Europe/London)</span>
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            {(Object.keys(hours) as DayKey[]).map((k) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "70px 110px 140px 140px", gap: 10, alignItems: "center" }}>
                <div><b>{dayLabel(k)}</b></div>
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
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}
                />
                <input
                  type="time"
                  value={hours[k].end}
                  onChange={(e) => setHours((prev) => ({ ...prev, [k]: { ...prev[k], end: e.target.value } }))}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #444", background: "#111", color: "#fff" }}
                />
              </div>
            ))}
          </div>

          <p style={{ opacity: 0.8, marginTop: 12 }}>
            Pro users: if “Open” right now → in-hours greeting. If closed → out-of-hours greeting. Standard users always use in-hours greeting.
          </p>
        </section>

        {/* Save buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={saveVoiceAndTts}
            disabled={saving}
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #444", background: "#1b1b1b", color: "#fff", cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Voice + TTS Settings"}
          </button>

          <button
            onClick={saveHours}
            disabled={saving}
            style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #444", background: "#1b1b1b", color: "#fff", cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}