"use client"

import { useEffect, useMemo, useState } from "react"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

type StripeSessionData = {
  session_id: string
  email: string | null
  name: string | null
  plan: "standard" | "pro"
}

export default function OnboardingPage() {
  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.search).get("session_id") || ""
  }, [])

  const [loading, setLoading] = useState(true)
  const [stripeData, setStripeData] = useState<StripeSessionData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function run() {
      try {
        if (!sessionId) throw new Error("Missing session_id in URL")
        const res = await fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || "Failed to load Stripe session")

        const d = j.data as StripeSessionData
        setStripeData(d)
        setFullName(d.name || "")
      } catch (e: any) {
        setErr(e?.message || "Failed to load")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [sessionId])

  async function onCreate() {
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      if (!stripeData?.email) throw new Error("No email found from Stripe checkout")
      if (!businessName.trim()) throw new Error("Business name is required")
      if (password.length < 10) throw new Error("Password must be at least 10 characters")

      const res = await fetch("/api/portal/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          full_name: fullName,
          business_name: businessName,
          password,
        }),
      })

      const j = await res.json()
      if (!res.ok) throw new Error(j.error || "Failed to create account")

      // Auto-login and redirect to portal
      const { error: loginErr } = await supabaseBrowser.auth.signInWithPassword({
        email: stripeData.email,
        password,
      })
      if (loginErr) throw new Error(loginErr.message)

      setMsg("Account created. Redirecting…")
      window.location.href = "/portal/voicemail"
    } catch (e: any) {
      setErr(e?.message || "Failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>Loading…</div>
  }

  if (err) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui", color: "salmon" }}>
        {err}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: "60px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Set up your portal access</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Plan: <b>{stripeData?.plan}</b>
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email (from Stripe)</span>
          <input
            value={stripeData?.email || ""}
            disabled
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#111", color: "#bbb" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Business name</span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Dan Handford Plumbing"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Create password (10+ characters)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: "#fff" }}
          />
        </label>

        <button
          onClick={onCreate}
          disabled={saving}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: saving ? "#222" : "#0f2a5a",
            color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            marginTop: 6,
          }}
        >
          {saving ? "Creating…" : "Create account & continue"}
        </button>

        {msg && <div style={{ color: "lime", marginTop: 6 }}>{msg}</div>}
        {err && <div style={{ color: "salmon", marginTop: 6 }}>{err}</div>}
      </div>
    </div>
  )
}