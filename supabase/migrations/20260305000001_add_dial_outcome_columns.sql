-- Migration: add dial outcome columns to calls
--
-- dial_call_status  : raw DialCallStatus value from Twilio (completed/no-answer/busy/failed/canceled)
-- dial_call_duration: DialCallDuration in seconds reported by Twilio
-- call_outcome      : computed outcome label (answered/missed/busy/failed/canceled)
--
-- answered_live is already present; this migration makes its value correct by
-- gating on duration >= 1 (see app/api/twilio/action/route.ts).

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS dial_call_status   text,
  ADD COLUMN IF NOT EXISTS dial_call_duration integer,
  ADD COLUMN IF NOT EXISTS call_outcome       text;
