"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"

export default function PortalPage() {
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [voicemailEnabled, setVoicemailEnabled] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      setUserEmail(user.email ?? null)
      setLoading(false)
    }

    getUser()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading portal...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-8">PlumberCallGuard</h2>

          <nav className="space-y-4">
            <div className="font-semibold text-gray-800">Dashboard</div>
            <div className="text-gray-600">Call Settings</div>
            <div className="text-gray-600">Voicemail</div>
            <div className="text-gray-600">Recordings</div>
            <div className="text-gray-600">Account</div>
          </nav>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.replace("/login")
          }}
          className="mt-10 text-sm text-red-500"
        >
          Log Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-8">{userEmail}</p>

        {/* Call Summary */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm text-gray-500 mb-2">
              Total Calls Today
            </h3>
            <p className="text-3xl font-bold">14</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-sm text-gray-500 mb-2">
              Missed Calls Today
            </h3>
            <p className="text-3xl font-bold text-red-500">6</p>
          </div>
        </div>

        {/* Voicemail Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm mb-10">
          <h2 className="text-lg font-semibold mb-4">Voicemail</h2>

          <div className="flex items-center justify-between mb-6">
            <span>Voicemail Active</span>
            <button
              onClick={() =>
                setVoicemailEnabled(!voicemailEnabled)
              }
              className={`px-4 py-2 rounded-lg ${
                voicemailEnabled
                  ? "bg-green-500 text-white"
                  : "bg-gray-300 text-gray-700"
              }`}
            >
              {voicemailEnabled ? "On" : "Off"}
            </button>
          </div>

          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
            Record Voicemail Greeting
          </button>
        </div>

        {/* Call Recordings */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-6">
            Call Recordings
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between border-b pb-3">
              <span>+44 7589 436 123</span>
              <span>10:53 AM</span>
            </div>

            <div className="flex justify-between border-b pb-3">
              <span>+44 7589 221 009</span>
              <span>10:45 AM</span>
            </div>

            <div className="flex justify-between border-b pb-3">
              <span>+44 7700 892 334</span>
              <span>09:20 AM</span>
            </div>
          </div>
        </div>

        {/* Pro Badge */}
        <div className="mt-10 bg-green-50 p-6 rounded-xl border border-green-200">
          <p className="text-green-700 font-semibold">
            You’re using the Pro plan.
          </p>
        </div>
      </main>
    </div>
  )
}