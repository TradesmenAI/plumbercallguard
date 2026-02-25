import { NextResponse } from "next/server"
import { twiml } from "twilio"

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("CallSid") as string
  const from = formData.get("From") as string

  const response = new twiml.VoiceResponse()

  response.say("Please leave a message after the beep.")

  response.record({
    maxLength: 30,
    playBeep: true,
    trim: "trim-silence",
    transcribe: true,
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"]
  })

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}