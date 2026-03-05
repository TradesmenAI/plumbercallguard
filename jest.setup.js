// Set test environment variables (route handlers read these at invocation time)
process.env.BASE_URL = "https://test.example.com"
process.env.SUPABASE_URL = "https://fake.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key"

// Ensure Web fetch globals are available in the Jest Node environment.
// Node 18.18+ ships them via undici; jest-environment-node may not expose them automatically.
if (typeof globalThis.Request === "undefined") {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const undici = require("undici")
    /* eslint-enable @typescript-eslint/no-require-imports */
    const globals = ["Request", "Response", "Headers", "FormData", "File", "fetch"]
    for (const name of globals) {
      if (undici[name]) globalThis[name] = undici[name]
    }
  } catch {
    // undici unavailable — globals already present or tests won't need them
  }
}
