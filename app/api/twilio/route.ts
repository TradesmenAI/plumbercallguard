import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isOutOfHours(now: Date, start: string, end: string) {
  const [startH, startM] = start.split(":").map(Number)
  const [endH, endM] = end.split(":").map(Number)

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes < endMinutes) {
    return currentMinutes < startMinutes || currentMinutes > endMinutes
  } else {
    return currentMinutes > startMinutes || currentMinutes < endMinutes
  }
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const from = formData.get("From") as string
  const to = formData.get("To") as string

  if (!callSid || !from || !to) {
    return new NextResponse("Missing data", { status: 400 })
  }

  /* -------------------------------------------------- */
  /* GET USER BY TWILIO NUMBER                         */
  /* -------------------------------------------------- */

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("twilio_number", to)
    .single()

  if (!user) {
    return new NextResponse("User not found", { status: 404 })
  }

  /* -------------------------------------------------- */
  /* SAVE CALL RECORD                                  */
  /* -------------------------------------------------- */

  await supabase
    .from("calls")
    .upsert(
      {
        call_sid: callSid,
        caller_number: from,
        user_id: user.id,
        call_status: "incoming"
      },
      { onConflict: "call_sid" }
    )

  /* -------------------------------------------------- */
  /* DETERMINE GREETING TYPE                           */
  /* -------------------------------------------------- */

  const now = new Date()
  const isOOH =
    user.ooh_enabled &&
    isOutOfHours(now, user.ooh_start, user.ooh_end)

  const greetingType = isOOH
    ? user.ooh_voicemail_type
    : user.voicemail_type

  const greetingMessage = isOOH
    ? user.ooh_voicemail_message
    : user.voicemail_message

  const greetingAudioPath = isOOH
    ? user.ooh_voicemail_audio_path
    : user.voicemail_audio_path

  const response = new twiml.VoiceResponse()

  /* -------------------------------------------------- */
  /* PLAY GREETING                                     */
  /* -------------------------------------------------- */

  if (greetingType === "audio" && greetingAudioPath) {
    const { data } = await supabase.storage
      .from("voicemails")
      .createSignedUrl(greetingAudioPath, 60)

    if (data?.signedUrl) {
      response.play(data.signedUrl)
    } else {
      response.say(greetingMessage || "Please leave a message after the beep.")
    }
  } else {
    response.say(
      {
        voice: "Polly.Amy",
        language: "en-GB"
      },
      greetingMessage || "Please leave a message after the beep."
    )
  }

  /* -------------------------------------------------- */
  /* RECORD MESSAGE                                    */
  /* -------------------------------------------------- */

  response.record({
    maxLength: 60,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST"
  })

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}