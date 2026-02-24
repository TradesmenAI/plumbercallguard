import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { twiml } from "twilio"
import Twilio from "twilio"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// ✅ TEMP TEST ROUTE
export async function GET() {
  return new Response("API is alive")
}

export async function POST(req: Request) {
  const formData = await req.formData()

  const from = formData.get("From") as string
  const to = formData.get("To") as string
  const callSid = formData.get("CallSid") as string

  let callerType = "unknown"

  try {
    const lookup = await twilioClient.lookups.v2.phoneNumbers(from).fetch()
    callerType = lookup.lineTypeIntelligence?.type || "unknown"
  } catch (err) {
    console.log("Lookup failed")
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("twilio_number", to)
    .single()

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  await supabase.from("calls").insert({
    user_id: user.id,
    caller_number: from,
    call_sid: callSid,
    caller_type: callerType,
    call_status: "incoming"
  })

  const response = new twiml.VoiceResponse()

  response.dial(
    {
      record: "record-from-answer",
      recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording`,
      recordingStatusCallbackMethod: "POST"
    },
    user.forwarding_number
  )

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" }
  })
}