import { NextResponse } from "next/server"
import { twiml } from "twilio"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const from = formData.get("From") as string

  // SAFE INSERT (prevents duplicates)
  await supabase.from("calls").upsert(
    {
      call_sid: callSid,
      caller_number: from,
      caller_type: "unknown",
      call_status: "recording"
    },
    { onConflict: "call_sid" }
  )

  const response = new twiml.VoiceResponse()

  response.say("Please leave a message after the beep.")

  response.record({
    maxLength: 30,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback:
      "https://www.plumbercallguard.co.uk/api/twilio/recording",
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"]
  })

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}