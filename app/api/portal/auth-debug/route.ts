import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/app/lib/supabaseServer"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const { supabase } = createSupabaseServerClient(req)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return NextResponse.json({
    ok: true,
    user: user
      ? {
          id: user.id,
          email: user.email,
        }
      : null,
    auth_error: error ? { message: error.message, name: (error as any).name } : null,
    env_present: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  })
}