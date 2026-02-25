import { NextResponse } from "next/server"
import { twiml } from "twilio"

export async function POST(req: Request) {
  const response = new twiml.VoiceResponse()

  response.say("Please leave a message after the beep.")

  response.record({
    maxLength: 30,
    playBeep: true,
    trim: "trim-silence",
    recordingStatusCallback: "https://www.plumbercallguard.co.uk/api/twilio/recording",
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"]
  })

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}