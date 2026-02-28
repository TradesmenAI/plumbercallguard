"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextPath = useMemo(() => {
    return searchParams.get("next") || "/portal/voicemail"
  }, [searchParams])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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

    router.replace(nextPath)
  }

  return (
    <div style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>Portal login</h1>
      <p>Sign in to manage your voicemail and call settings.</p>

      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={onLogin} disabled={saving}>
          {saving ? "Signing in…" : "Sign in"}
        </button>

        {err && <div style={{ color: "red" }}>{err}</div>}
      </div>
    </div>
  )
}