"use client"

import { useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function LoginPage() {
  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/portal/voicemail"
    return new URLSearchParams(window.location.search).get("next") || "/portal/voicemail"
  }, [])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabaseBrowser.auth.getUser()
      if (data.user) window.location.href = nextPath
    })()
  }, [nextPath])

  async function onLogin() {
    setErr(null)
    setSaving(true)
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (error) throw error
      window.location.href = nextPath
    } catch (e: any) {
      setErr(e?.message || "Login failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Portal login</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>Sign in to manage your voicemail and call settings.</p>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <button
          onClick={onLogin}
          disabled={saving}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: saving ? "#222" : "#0f2a5a",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Signing in…" : "Sign in"}
        </button>

        {err && <div style={{ color: "salmon" }}>{err}</div>}

        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Paid but no account yet?{" "}
          <a href="/" style={{ color: "#4ea1ff" }}>
            Go back to the website
          </a>
          .
        </div>
      </div>
    </div>
  )
}