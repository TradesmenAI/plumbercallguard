"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/portal/voicemail"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (data.session) {
        router.replace(nextPath)
      }
    }
    check()
  }, [router, nextPath])

  async function onLogin() {
    setErr(null)
    setSaving(true)

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErr(error.message)
      setSaving(false)
      return
    }

    // force session sync before redirect
    await supabaseBrowser.auth.getSession()

    router.replace(nextPath)
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: 20, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Portal login</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Sign in to manage your voicemail and call settings.
      </p>

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
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}