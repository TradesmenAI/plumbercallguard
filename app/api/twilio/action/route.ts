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

export async function POST(req: Request) {
  const formData = await req.formData()
  const callSid = String(formData.get("CallSid") || "")
  const dialCallStatus = String(formData.get("DialCallStatus") || "")

  if (!callSid) return new NextResponse("Missing CallSid", { status: 400 })

  // Fetch the original call row to obtain the user_id
  const { data: callRow } = await supabase
    .from("calls")
    .select("user_id")
    .eq("call_sid", callSid)
    .single()

  if (dialCallStatus === "completed") {
    // Plumber answered the call — mark as live-answered and end
    if (callRow?.user_id) {
      await supabase
        .from("calls")
        .update({ answered_live: true, call_status: "completed" })
        .eq("call_sid", callSid)
    }
    const response = new twiml.VoiceResponse()
    response.hangup()
    return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
  }

  // Plumber did not answer (no-answer / busy / failed / canceled) — route to voicemail
  if (callRow?.user_id) {
    await supabase
      .from("calls")
      .update({ answered_live: false })
      .eq("call_sid", callSid)
  }

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
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
  })
  response.hangup()
  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } })
}
