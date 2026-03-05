/**
 * Automated tests for the Twilio inbound call flow.
 *
 * These tests POST directly to the route handlers and inspect the returned TwiML
 * without making any real Twilio / Supabase / OpenAI network calls.
 *
 * Variables prefixed with "mock" are hoisted alongside jest.mock() calls,
 * allowing the factory closure to read their current values per-test.
 */

// ---------------------------------------------------------------------------
// Shared mock state (reassigned in beforeEach / individual tests)
// ---------------------------------------------------------------------------

let mockUserResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: null,
  error: { message: "not found" },
}

let mockBlockedResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: null,
  error: null,
}

let mockCallResult: { data: Record<string, unknown> | null; error: unknown } = {
  data: null,
  error: { message: "not found" },
}

// ---------------------------------------------------------------------------
// Supabase mock — intercepts ALL imports of @supabase/supabase-js
// ---------------------------------------------------------------------------

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      // Build a chainable mock; terminal methods resolve with the appropriate state
      const makeChain = (result: { data: unknown; error: unknown }) => {
        const chain: Record<string, unknown> = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          upsert: jest.fn().mockResolvedValue({ error: null }),
          single: jest.fn().mockImplementation(() => Promise.resolve(result)),
          maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(result)),
        }
        // Make the chain directly awaitable (e.g. `await supabase.from("calls").update({}).eq(...)`)
        chain.then = jest.fn().mockImplementation((onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled)
        )
        return chain
      }

      if (table === "users") return makeChain(mockUserResult)
      if (table === "blocked_numbers") return makeChain(mockBlockedResult)
      if (table === "calls") return makeChain(mockCallResult)
      return makeChain({ data: null, error: null })
    }),
  })),
}))

// ---------------------------------------------------------------------------
// Import route handlers AFTER jest.mock so they receive the mocked module
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/twilio/route"
import { POST as ACTION_POST } from "@/app/api/twilio/action/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, params: Record<string, string>): Request {
  const body = new FormData()
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value)
  }
  return new Request(url, { method: "POST", body })
}

async function getTwiml(res: Response): Promise<string> {
  return res.text()
}

// A realistic user row with plumber_phone set
const PLUMBER_USER: Record<string, unknown> = {
  id: "user-uuid-1",
  plan: "standard",
  twilio_number: "+441234000000",
  twilio_number_2: null,
  plumber_phone: "+447900000001",
  voicemail_in_mode: "tts",
  voicemail_in_tts: "Please leave a message and we will call you back.",
  voicemail_out_mode: "tts",
  voicemail_out_tts: "We are closed. Please leave a message.",
  business_hours: null,
  ooh_enabled: false,
  timezone: "Europe/London",
  voicemail_token: "",
  tts_voice_gender: "female",
}

// BASE_URL is set in jest.setup.js — capture it here so assertions use it
const TEST_BASE_URL = process.env.BASE_URL as string

// ---------------------------------------------------------------------------
// Tests: main inbound webhook /api/twilio
// ---------------------------------------------------------------------------

describe("POST /api/twilio — inbound call flow", () => {
  beforeEach(() => {
    mockUserResult = { data: null, error: { message: "not found" } }
    mockBlockedResult = { data: null, error: null }
    mockCallResult = { data: null, error: { message: "not found" } }
  })

  test("blocked caller: TwiML contains <Hangup> and does NOT contain <Dial> or <Record>", async () => {
    mockUserResult = { data: PLUMBER_USER, error: null }
    mockBlockedResult = { data: { id: "block-row-1" }, error: null }

    const req = makeRequest("https://example.com/api/twilio", {
      CallSid: "CA_BLOCKED_001",
      From: "+440000000000",
      To: "+441234000000",
    })

    const res = await POST(req)
    const xml = await getTwiml(res)

    expect(xml).toContain("<Hangup")
    expect(xml).not.toContain("<Dial")
    expect(xml).not.toContain("<Record")
  })

  test("normal call: <Pause> before disclaimer <Play>, <Play> before <Dial>, and <Dial> has action callback from BASE_URL", async () => {
    mockUserResult = { data: PLUMBER_USER, error: null }
    mockBlockedResult = { data: null, error: null }

    const req = makeRequest("https://example.com/api/twilio", {
      CallSid: "CA_NORMAL_002",
      From: "+441234567890",
      To: "+441234000000",
    })

    const res = await POST(req)
    const xml = await getTwiml(res)

    const pauseIdx = xml.indexOf("<Pause")
    const playIdx  = xml.indexOf("<Play")
    const dialIdx  = xml.indexOf("<Dial")

    // All three verbs must be present
    expect(pauseIdx).toBeGreaterThanOrEqual(0)
    expect(playIdx).toBeGreaterThanOrEqual(0)
    expect(dialIdx).toBeGreaterThanOrEqual(0)

    // 1-second pause must precede the disclaimer
    expect(xml).toContain('length="1"')
    expect(pauseIdx).toBeLessThan(playIdx)

    // Disclaimer must come BEFORE the Dial
    expect(playIdx).toBeLessThan(dialIdx)

    // Disclaimer Play URL must be built from BASE_URL (not hardcoded domain)
    expect(xml).toContain(`${TEST_BASE_URL}/disclaimer.mp3`)

    // Dial must have an action pointing to BASE_URL/api/twilio/action
    expect(xml).toContain("action=")
    expect(xml).toContain(`${TEST_BASE_URL}/api/twilio/action`)

    // No <Record> in the initial response (recording happens after no-answer)
    expect(xml).not.toContain("<Record")
  })

  test("no user found: unassigned voicemail recordingStatusCallback uses BASE_URL", async () => {
    mockUserResult = { data: null, error: { message: "not found" } }

    const req = makeRequest("https://example.com/api/twilio", {
      CallSid: "CA_UNASSIGNED_005",
      From: "+440000000099",
      To: "+449999999999",
    })

    const res = await POST(req)
    const xml = await getTwiml(res)

    expect(xml).toContain("<Record")
    expect(xml).toContain(`${TEST_BASE_URL}/api/twilio/recording`)
  })
})

// ---------------------------------------------------------------------------
// Tests: Dial action callback /api/twilio/action
// ---------------------------------------------------------------------------

describe("POST /api/twilio/action — Dial result callback", () => {
  beforeEach(() => {
    mockUserResult = { data: null, error: { message: "not found" } }
    mockCallResult = { data: null, error: { message: "not found" } }
    mockBlockedResult = { data: null, error: null }
  })

  test("missed call (no-answer): voicemail greeting appears before <Record>, and <Record> has recordingStatusCallback from BASE_URL", async () => {
    mockCallResult = { data: { user_id: "user-uuid-1" }, error: null }
    mockUserResult = { data: PLUMBER_USER, error: null }

    const req = makeRequest("https://example.com/api/twilio/action", {
      CallSid: "CA_MISSED_003",
      DialCallStatus: "no-answer",
      DialCallDuration: "0",
    })

    const res = await ACTION_POST(req)
    const xml = await getTwiml(res)

    // Either <Say> or <Play> acts as the voicemail greeting
    const sayIdx = xml.includes("<Say") ? xml.indexOf("<Say") : Infinity
    const playIdx = xml.includes("<Play") ? xml.indexOf("<Play") : Infinity
    const greetingIdx = Math.min(sayIdx, playIdx)
    const recordIdx = xml.indexOf("<Record")

    // <Record> must be present
    expect(recordIdx).toBeGreaterThanOrEqual(0)

    // Greeting must appear before <Record>
    expect(greetingIdx).toBeLessThan(recordIdx)

    // recordingStatusCallback must point back to the transcription pipeline via BASE_URL
    expect(xml).toContain("recordingStatusCallback=")
    expect(xml).toContain(`${TEST_BASE_URL}/api/twilio/recording`)
  })

  test("answered call (completed): TwiML contains only <Hangup>, no voicemail verbs", async () => {
    mockCallResult = { data: { user_id: "user-uuid-1" }, error: null }
    mockUserResult = { data: PLUMBER_USER, error: null }

    const req = makeRequest("https://example.com/api/twilio/action", {
      CallSid: "CA_ANSWERED_004",
      DialCallStatus: "completed",
      DialCallDuration: "45",
    })

    const res = await ACTION_POST(req)
    const xml = await getTwiml(res)

    expect(xml).toContain("<Hangup")
    expect(xml).not.toContain("<Record")
    expect(xml).not.toContain("<Say")
  })

  test("fallback generic voicemail: recordingStatusCallback uses BASE_URL when user lookup fails", async () => {
    mockCallResult = { data: null, error: { message: "not found" } }
    mockUserResult = { data: null, error: { message: "not found" } }

    const req = makeRequest("https://example.com/api/twilio/action", {
      CallSid: "CA_FALLBACK_006",
      DialCallStatus: "no-answer",
      DialCallDuration: "0",
    })

    const res = await ACTION_POST(req)
    const xml = await getTwiml(res)

    expect(xml).toContain("<Record")
    expect(xml).toContain(`${TEST_BASE_URL}/api/twilio/recording`)
  })
})
