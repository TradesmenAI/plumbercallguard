"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/app/lib/supabaseBrowser"

export default function PortalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      // Server-side auth is source of truth
      const meRes = await fetch("/api/portal/me")
      if (meRes.status === 401) {
        router.replace("/login?next=/portal")
        return
      }

      const meJson = await meRes.json().catch(() => null)
      const emailFromProfile = meJson?.data?.email || null

      // Optional: keep browser auth in sync (for signOut)
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser()

      setUserEmail(user?.email ?? emailFromProfile)
      setLoading(false)
    }

    run()
  }, [router])

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading portal...</div>
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white shadow-md p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-8">PlumberCallGuard</h2>

          <nav className="space-y-4">
            <button
              onClick={() => router.push("/portal/inbox")}
              className="w-full text-left font-semibold text-gray-800 hover:underline"
            >
              Inbox
            </button>

            <div className="text-gray-600">Dashboard</div>
            <div className="text-gray-600">Call Settings</div>
            <div className="text-gray-600">Voicemail</div>
            <div className="text-gray-600">Recordings</div>
            <div className="text-gray-600">Account</div>
          </nav>
        </div>

        <button
          onClick={async () => {
            await supabaseBrowser.auth.signOut()
            router.replace("/login")
          }}
          className="mt-10 text-sm text-red-500"
        >
          Log Out
        </button>
      </aside>

      <main className="flex-1 p-10">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-8">{userEmail}</p>

        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm text-gray-500 mb-2">Total Calls Today</h3>
            <p className="text-3xl font-bold">14</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm text-gray-500 mb-2">Missed Calls Today</h3>
            <p className="text-3xl font-bold text-red-500">6</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/portal/inbox")}
          className="bg-black text-white px-4 py-2 rounded-lg font-semibold"
        >
          Open Inbox
        </button>
      </main>
    </div>
  )
}