"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function PortalHome() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getUser()

      if (!data.user) {
        router.replace("/login?next=/portal/voicemail")
      } else {
        router.replace("/portal/voicemail")
      }
    }

    check()
  }, [router])

  return null
}