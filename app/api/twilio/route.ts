import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* Reliable UK Time Detection */
function isBusinessHoursUK() {
  const now = new Date()

  // Get UTC time
  const utcHour = now.getUTCHours()
  const month = now.getUTCMonth() + 1
  const date = now.getUTCDate()

  // Basic UK DST detection (last Sunday March to last Sunday October)
  function isDST() {
    const year = now.getUTCFullYear()

    const marchLastSunday = new Date(Date.UTC(year, 2, 31))
    marchLastSunday.setUTCDate(
      31 - marchLastSunday.getUTCDay()
    )

    const octoberLastSunday = new Date(Date.UTC(year, 9, 31))
    octoberLastSunday.setUTCDate(
      31 - octoberLastSunday.getUTCDay()
    )

    return now >= marchLastSunday && now < octoberLastSunday
  }

  const ukHour = isDST() ? utcHour + 1 : utcHour

  return ukHour >= 9 && ukHour < 17
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const from = formData.get("From") as string
  const to = formData.get("To") as string

  if (!callSid || !from || !to) {
    return new NextResponse("Missing data", { status: 400 })
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("twilio_number", to)
    .single()

  if (!user) {
    return new NextResponse("User not found", { status: 404 })
  }

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

  const inHours = isBusinessHoursUK()

  const inHoursMessage =
    "Thank you for calling XYZ Plumbing. Please leave a message and we will get back to you as soon as possible."

  const outOfHoursMessage =
    "Thank you for calling XYZ Plumbing. We are currently closed. Please leave a message and we will get back to you as soon as we open."

  const message = inHours ? inHoursMessage : outOfHoursMessage

  const response = new twiml.VoiceResponse()

  response.say(
    {
      voice: "Polly.Amy",
      language: "en-GB"
    },
    message
  )

  response.record({
    maxLength: 60,
    timeout: 5,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST"
  })

  response.hangup()

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}