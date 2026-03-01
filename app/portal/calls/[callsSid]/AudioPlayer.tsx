"use client"

import { useEffect, useRef, useState } from "react"

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  async function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      await el.play().catch(() => null)
    } else {
      el.pause()
    }
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onEnded)

    return () => {
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onEnded)
    }
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-700 truncate">{src}</div>
        <button
          onClick={toggle}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <audio ref={audioRef} controls className="mt-3 w-full" src={src} />
    </div>
  )
}