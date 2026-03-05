import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"
import {
  isOpenNowFromBusinessHours,
  isOpenNowLegacyOOH,
  appendVoicemailTwiml,
} from "@/app/lib/twilio-helpers"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const runtime = "nodejs"

function normalizeE164(input: string) {
  return String(input || "").trim().replace(/[^\d+]/g, "")
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const callSid = formData.get("CallSid") as string
  const fromRaw = formData.get("From") as string
  const toRaw = formData.get("To") as string

  if (!callSid || !fromRaw || !toRaw) return new NextResponse("Missing data", { status: 400 })

  const from = normalizeE164(fromRaw)
  const to = normalizeE164(toRaw)

  // Look up user by primary OR secondary Twilio number (Standard → twilio_number, Pro → may use twilio_number_2)
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .or(`twilio_number.eq.${to},twilio_number_2.eq.${to}`)
    .single()

  // No user matched → generic unassigned voicemail (preserved existing behaviour)
  if (!user) {
    await supabase.from("calls").upsert(
      { call_sid: callSid, caller_number: from, user_id: null, inbound_to: to, unassigned: true, call_status: "incoming" },
      { onConflict: "call_sid" }
    )

    const response = new twiml.VoiceResponse()
    response.say({ voice: "Polly.Emma-Neural", language: "en-GB" }, "Thanks for calling. Please leave a message after the beep.")
    response.record({
      maxLength: 60,
      timeout: 5,
      playBeep: true,
      trim: "trim-silence",
      recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
      recordingStatusCallbackMethod: "POST",
    })
    response.hangup()
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
  }

  // Record call row immediately so downstream callbacks can find it
  await supabase.from("calls").upsert(
    { call_sid: callSid, caller_number: from, user_id: user.id, inbound_to: to, unassigned: false, call_status: "incoming" },
    { onConflict: "call_sid" }
  )

  // Blocked caller → silent hangup; no ringing, no voicemail, no SMS
  const { data: blocked } = await supabase
    .from("blocked_numbers")
    .select("id")
    .eq("user_id", user.id)
    .eq("caller_number", from)
    .maybeSingle()

  if (blocked) {
    const response = new twiml.VoiceResponse()
    response.hangup()
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
  }

  const plan = String(user.plan || "standard").toLowerCase()
  const isPro = plan === "pro"
  const openNow = user.business_hours ? isOpenNowFromBusinessHours(user) : isOpenNowLegacyOOH(user)
  const cfgType: "in" | "out" = isPro ? (openNow ? "in" : "out") : "in"

  const response = new twiml.VoiceResponse()

  // Compliance disclaimer plays before any dialling or voicemail
  response.play(`${process.env.BASE_URL}/disclaimer.mp3`)

  if (user.plumber_phone) {
    // Dial the plumber's real number. The action callback handles answered vs no-answer.
    const dial = response.dial({
      action: `${process.env.BASE_URL}/api/twilio/action`,
      method: "POST",
      timeout: 20,
    })
    dial.number(String(user.plumber_phone))
  } else {
    // Fallback: plumber_phone not yet configured — route straight to voicemail
    appendVoicemailTwiml(response, user, cfgType)
  }

  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
}
