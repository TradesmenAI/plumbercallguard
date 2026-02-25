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
    recordingStatusCallback: "https://www.plumbercallguard.co.uk/api/twilio/recording",
    recordingStatusCallbackMethod: "POST"
  })

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}