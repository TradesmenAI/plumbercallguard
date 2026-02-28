"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function PortalHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getUser()

      if (!data.user) {
        router.replace("/login")
        return
      }

      setLoading(false)
    }

    check()
  }, [router])

  if (loading) return null

  return (
    <div style={{ padding: 40 }}>
      <h1>Your Portal</h1>

      <div style={{ marginTop: 30 }}>
        <h2>Voicemail</h2>
        <button>Record Voicemail</button>
      </div>
    </div>
  )
}