"use client"

import { useEffect } from "react"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function PortalHome() {
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getUser()

      if (!data.user) {
        window.location.href = "/login?next=/portal/voicemail"
      } else {
        window.location.href = "/portal/voicemail"
      }
    })()
  }, [])

  return null
}