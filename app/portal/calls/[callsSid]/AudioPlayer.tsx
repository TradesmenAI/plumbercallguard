"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  src: string
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function AudioPlayer({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number>(0)
  const [current, setCurrent] = useState<number>(0)

  const durationLabel = useMemo(() => formatTime(duration), [duration])
  const currentLabel = useMemo(() => formatTime(current), [current])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    setReady(false)
    setPlaying(false)
    setDuration(0)
    setCurrent(0)

    const onLoadedMetadata = () => {
      const d = el.duration
      if (Number.isFinite(d) && d > 0) setDuration(d)
      setReady(true)
    }

    const onTimeUpdate = () => setCurrent(el.currentTime || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    el.addEventListener("loadedmetadata", onLoadedMetadata)
    el.addEventListener("timeupdate", onTimeUpdate)
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onEnded)

    // Force a metadata fetch even before the user presses play.
    // preload="metadata" helps, but load() makes it explicit.
    try {
      el.load()
    } catch {
      // ignore
    }

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata)
      el.removeEventListener("timeupdate", onTimeUpdate)
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onEnded)
    }
  }, [src])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  function onSeek(next: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = next
    setCurrent(next)
  }

  const max = Number.isFinite(duration) && duration > 0 ? duration : 0

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {/* Keep audio element in DOM so metadata can preload */}
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
          disabled={!src}
        >
          {playing ? "⏸" : "▶️"}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={Math.min(current, max || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            disabled={!ready || !max}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{currentLabel}</span>
            <span>{ready && max ? durationLabel : "Loading…"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}