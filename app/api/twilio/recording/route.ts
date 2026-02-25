import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import twilio from "twilio"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(req: Request) {
  const formData = await req.formData()

  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingDuration = formData.get("RecordingDuration") as string
  const callSid = formData.get("CallSid") as string

  console.log("Recording webhook hit")
  console.log("CallSid:", callSid)

  if (!recordingUrl || !callSid) {
    console.log("Missing recordingUrl or callSid")
    return NextResponse.json({ ok: false })
  }

  /* -------------------------------------------------- */
  /* GET CALLER NUMBER FROM DATABASE                   */
  /* -------------------------------------------------- */

  const { data: callData, error: callError } = await supabase
    .from("calls")
    .select("caller_number")
    .eq("call_sid", callSid)
    .single()

  console.log("DB lookup result:", callData)
  console.log("DB lookup error:", callError)

  const callerNumber = callData?.caller_number

  let callerType = "unknown"

  /* -------------------------------------------------- */
  /* TWILIO LOOKUP LINE TYPE                           */
  /* -------------------------------------------------- */

  if (callerNumber) {
    try {
      console.log("Running lookup for:", callerNumber)

      const lookup = await twilioClient.lookups.v2
        .phoneNumbers(callerNumber)
        .fetch({ fields: "line_type_intelligence" })

      console.log("Lookup response:", lookup)

      if (lookup.lineTypeIntelligence?.type) {
        callerType = lookup.lineTypeIntelligence.type
      }
    } catch (err) {
      console.log("Lookup failed:", err)
    }
  } else {
    console.log("No caller number found in DB")
  }

  /* -------------------------------------------------- */
  /* SAVE RECORDING + CALLER TYPE                      */
  /* -------------------------------------------------- */

  const { error: updateError } = await supabase
    .from("calls")
    .update({
      recording_url: recordingUrl + ".mp3",
      recording_duration: recordingDuration,
      caller_type: callerType,
      call_status: "completed"
    })
    .eq("call_sid", callSid)

  console.log("Update error:", updateError)

  return NextResponse.json({ ok: true })
}