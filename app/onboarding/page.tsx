import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const STANDARD = process.env.STRIPE_STANDARD_PRICE_ID!
const PRO = process.env.STRIPE_PRO_PRICE_ID!

function normalizeTwilioNumber(input: string) {
  const trimmed = (input || "").trim()
  return trimmed.replace(/[^\d+]/g, "")
}

function isE164(v: string) {
  return /^\+\d{7,15}$/.test(v)
}

async function findUserByEmailPaginated(email: string) {
  const target = email.toLowerCase().trim()
  const perPage = 200
  const MAX_PAGES = 200

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage })
    if (listErr) return { user: null as any, error: listErr }

    const users = list?.users || []
    const found = users.find((u) => (u.email || "").toLowerCase() === target)
    if (found) return { user: found, error: null }
    if (users.length < perPage) break
  }

  return { user: null as any, error: null }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as any

    const sessionId = String(body?.session_id || "")
    const password = String(body?.password || "")
    const fullName = String(body?.full_name || "").trim()
    const businessName = String(body?.business_name || "").trim()
    const twilioNumber = normalizeTwilioNumber(String(body?.twilio_number || ""))

    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
    if (password.length < 10) return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 })
    if (!businessName) return NextResponse.json({ error: "Business name is required" }, { status: 400 })

    if (!twilioNumber) return NextResponse.json({ error: "Twilio business number is required" }, { status: 400 })
    if (!isE164(twilioNumber)) return NextResponse.json({ error: "Twilio number must be in E.164 format (e.g. +447123456789)" }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    })

    if (session.status !== "complete") {
      return NextResponse.json({ error: "Checkout not complete" }, { status: 400 })
    }

    const email = session.customer_details?.email ?? null
    const nameFromStripe = session.customer_details?.name ?? null
    if (!email) return NextResponse.json({ error: "No email found on Stripe session" }, { status: 400 })

    const priceId = session.line_items?.data?.[0]?.price?.id ?? null

    let plan: "standard" | "pro" = "standard"
    if (priceId === PRO) plan = "pro"
    if (priceId === STANDARD) plan = "standard"

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || nameFromStripe || null,
        business_name: businessName || null,
      },
    })

    // If already exists, we still upsert DB row and return success
    if (createErr) {
      const { user: existing, error: listErr } = await findUserByEmailPaginated(email)
      if (listErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      if (!existing) return NextResponse.json({ error: createErr.message }, { status: 500 })

      const { error: upErr } = await admin.from("users").upsert({
        id: existing.id,
        email,
        full_name: fullName || nameFromStripe || null,
        business_name: businessName,
        plan,
        timezone: "Europe/London",
        twilio_number: twilioNumber,
      })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

      return NextResponse.json({ success: true, email })
    }

    const userId = created.user?.id
    if (!userId) return NextResponse.json({ error: "User created but missing id" }, { status: 500 })

    const { error: dbErr } = await admin.from("users").upsert({
      id: userId,
      email,
      full_name: fullName || nameFromStripe || null,
      business_name: businessName,
      plan,
      timezone: "Europe/London",
      twilio_number: twilioNumber,
    })

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    return NextResponse.json({ success: true, email })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create account" }, { status: 500 })
  }
}