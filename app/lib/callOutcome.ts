/**
 * UI-only display logic for call outcome labels.
 *
 * DB values (call_outcome, dial_call_duration) are NEVER modified here.
 * Rules:
 *   answered + dial_call_duration < 5s  => "Declined"  (plumber picked up and dropped)
 *   answered + dial_call_duration >= 5s => "Answered"
 *   missed                              => "Missed"
 *   busy                                => "Busy"
 *   failed                              => "Failed"
 *   canceled                            => "Declined"  (consistent with short-answer)
 *   anything else / null                => ""
 */

export type DisplayOutcome = "Declined" | "Answered" | "Missed" | "Busy" | "Failed" | ""

export function getDisplayOutcome(call: {
  call_outcome?: string | null
  dial_call_duration?: number | null
}): DisplayOutcome {
  const outcome = call.call_outcome ?? ""
  const duration = call.dial_call_duration ?? 0

  if (outcome === "answered") {
    return duration < 5 ? "Declined" : "Answered"
  }
  if (outcome === "missed") return "Missed"
  if (outcome === "busy") return "Busy"
  if (outcome === "failed") return "Failed"
  if (outcome === "canceled") return "Declined"
  return ""
}

export function outcomeChipClasses(label: DisplayOutcome): string {
  switch (label) {
    case "Declined":
      return "bg-orange-50 text-orange-700"
    case "Answered":
      return "bg-emerald-50 text-emerald-700"
    case "Missed":
      return "bg-rose-50 text-rose-700"
    case "Busy":
      return "bg-amber-50 text-amber-700"
    case "Failed":
      return "bg-slate-100 text-slate-500"
    default:
      return "bg-slate-100 text-slate-500"
  }
}
