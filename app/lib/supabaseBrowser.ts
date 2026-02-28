import { createBrowserClient } from "@supabase/ssr"

function setCookie(name: string, value: string, options?: any) {
  const parts: string[] = [`${name}=${value}`]

  const path = options?.path ?? "/"
  parts.push(`Path=${path}`)

  if (options?.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options?.expires) parts.push(`Expires=${new Date(options.expires).toUTCString()}`)
  if (options?.domain) parts.push(`Domain=${options.domain}`)

  // default safe behaviour
  const sameSite = options?.sameSite ?? "Lax"
  parts.push(`SameSite=${sameSite}`)

  // If you're on https, secure cookies are required for many browsers
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"
  const secure = options?.secure ?? isHttps
  if (secure) parts.push("Secure")

  document.cookie = parts.join("; ")
}

export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        if (typeof document === "undefined") return []
        const raw = document.cookie ? document.cookie.split("; ") : []
        return raw
          .map((c) => {
            const eq = c.indexOf("=")
            if (eq === -1) return null
            const name = c.slice(0, eq)
            const value = c.slice(eq + 1)
            return { name, value }
          })
          .filter(Boolean) as { name: string; value: string }[]
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return
        cookiesToSet.forEach(({ name, value, options }) => setCookie(name, value, options))
      },
    },
  }
)