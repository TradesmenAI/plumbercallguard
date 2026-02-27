import { NextRequest } from "next/server"

export function requireAdminKey(req: NextRequest) {
  const expected = process.env.ADMIN_SETTINGS_KEY
  const got = req.headers.get("x-admin-key")

  if (!expected) {
    return { ok: false as const, status: 500 as const, error: "ADMIN_SETTINGS_KEY not set" }
  }

  if (!got || got !== expected) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" }
  }

  return { ok: true as const }
}