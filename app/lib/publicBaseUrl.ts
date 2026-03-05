/**
 * Returns the production base URL from the BASE_URL environment variable.
 * Throws a clear error if BASE_URL is missing so we never silently generate
 * wrong Twilio callback URLs.
 *
 * Set BASE_URL in Vercel environment variables for production:
 *   BASE_URL=https://app.plumbercallguard.co.uk
 */
export function publicBaseUrl(): string {
  const url = process.env.BASE_URL
  if (!url) {
    throw new Error(
      "BASE_URL environment variable is not set. " +
        "Set it in Vercel (production) or .env.local (development). " +
        "Example: BASE_URL=https://app.plumbercallguard.co.uk"
    )
  }
  return url
}
