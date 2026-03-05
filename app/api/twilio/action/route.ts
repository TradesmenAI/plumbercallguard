import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"
import {
  isOpenNowFromBusinessHours,
  isOpenNowLegacyOOH,
  appendVoicemailTwiml,
} from "@/app/lib/twilio-helpers"
import { publicBaseUrl } from "@/app/lib/publicBaseUrl"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const runtime = "nodejs"

/**
 * Map raw Twilio DialCallStatus + duration to a human-readable outcome label.
 *
 * Twilio reports "completed" for ANY dial leg that was connected — even a
 * zero-second connection where the plumber picked up and immediately rejected.
 * We only treat a call as genuinely answered when duration >= 1 second.
 */
function computeCallOutcome(status: string, durationSecs: number): string {
  if (status === "completed") return durationSecs >= 1 ? "answered" : "missed"
  if (status === "no-answer") return "missed"
  if (status === "busy") return "busy"
  if (status === "failed") return "failed"
  if (status === "canceled") return "canceled"
  return "unknown"
}

export async function POST(req: Request) {
  const base = publicBaseUrl()

  const formData = await req.formData()
  const callSid = String(formData.get("CallSid") || "")

  // DialCallStatus is ONLY present on Action #1 (the <Dial> completion callback).
  // Action #2 (voicemail record completion) has RecordingSid/Digits but no DialCallStatus.
  // We must gate all dial/outcome DB writes on its presence to stay idempotent.
  const rawDialCallStatus = formData.get("DialCallStatus")
  const hasDialCallStatus = rawDialCallStatus !== null
  const dialCallStatus = hasDialCallStatus ? String(rawDialCallStatus) : ""
  const dialCallDuration = Math.max(0, parseInt(String(formData.get("DialCallDuration") || "0"), 10) || 0)

  if (!callSid) return new NextResponse("Missing CallSid", { status: 400 })

  // Fetch the original call row to obtain the user_id
  const { data: callRow } = await supabase
    .from("calls")
    .select("user_id")
    .eq("call_sid", callSid)
    .single()

  // A call is only genuinely answered when the plumber spoke for at least 1 second.
  // completed+duration=0 means the plumber picked up and immediately rejected — treat as missed.
  const answeredLive = hasDialCallStatus && dialCallStatus === "completed" && dialCallDuration >= 1
  const callOutcome = hasDialCallStatus ? computeCallOutcome(dialCallStatus, dialCallDuration) : null

  if (callRow && hasDialCallStatus) {
    // Action #1 only: persist dial outcome fields. Never run this on the voicemail
    // record completion callback (Action #2) — that would overwrite correct DB values.
    await supabase
      .from("calls")
      .update({
        dial_call_status: dialCallStatus,
        dial_call_duration: dialCallDuration,
        call_outcome: callOutcome,
        answered_live: answeredLive,
        ...(answeredLive ? { call_status: "completed" } : {}),
      })
      .eq("call_sid", callSid)
  }

  if (!hasDialCallStatus) {
    // Action #2: recording completion callback — nothing to update, just end the call.
    const response = new twiml.VoiceResponse()
    response.hangup()
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
  }

  if (answeredLive) {
    // Plumber genuinely answered — end the caller's leg cleanly
    const response = new twiml.VoiceResponse()
    response.hangup()
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
  }

  // Plumber did not answer (no-answer / busy / failed / canceled / completed+0s) → voicemail
  const response = new twiml.VoiceResponse()

  if (callRow?.user_id) {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", callRow.user_id)
      .single()

    if (user) {
      const plan = String(user.plan || "standard").toLowerCase()
      const isPro = plan === "pro"
      const openNow = user.business_hours ? isOpenNowFromBusinessHours(user) : isOpenNowLegacyOOH(user)
      const cfgType: "in" | "out" = isPro ? (openNow ? "in" : "out") : "in"
      appendVoicemailTwiml(response, user, cfgType)
      return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
    }
  }

  // Fallback generic voicemail when user lookup fails
  response.say({ voice: "Polly.Emma-Neural", language: "en-GB" }, "Please leave a message after the beep.")
  response.record({
    maxLength: 60,
    timeout: 5,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: `${base}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  })
  response.hangup()
  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
}
