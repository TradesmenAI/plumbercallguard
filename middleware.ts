import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // This refreshes the session cookie if needed
  await supabase.auth.getUser()

  return res
}

// Run middleware only on page routes.
// Excluded: _next/* assets, /api/* (Twilio webhooks must be reachable without
// auth overhead), favicon.ico, and any path that ends with a file extension
// (covers public/ assets such as .mp3, .svg, .png, .ico, .txt, .js, .css …).
export const config = {
  matcher: [
    "/((?!_next/|api/|favicon\\.ico|.*\\.\\w+$).*)",
  ],
}