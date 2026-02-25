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

  await supabase
    .from("calls")
    .upsert(
      {
        call_sid: callSid,
        caller_number: from,
        call_status: "incoming"
      },
      { onConflict: "call_sid" }
    )

  const response = new twiml.VoiceResponse()

  response.say("Please leave a message after the beep.")

  response.record({
    maxLength: 30,
    playBeep: true,
    trim: "trim-silence",
    transcribe: true,
    recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
    recordingStatusCallbackMethod: "POST"
  })

  // Inject transcriptionCallback manually into XML
  let xml = response.toString()

  xml = xml.replace(
    "<Record ",
    `<Record transcriptionCallback="${process.env.BASE_URL}/api/twilio/transcription" `
  )

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" }
  })
}