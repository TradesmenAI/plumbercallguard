import { NextResponse, type NextRequest } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var")
  // IMPORTANT: no apiVersion here to avoid TS mismatch
  return new Stripe(key)
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe()
    const { plan } = await req.json().catch(() => ({ plan: "standard" }))

    const baseUrl = process.env.BASE_URL
    if (!baseUrl) throw new Error("Missing BASE_URL env var")

    const standardPriceId = process.env.STRIPE_STANDARD_PRICE_ID
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID
    if (!standardPriceId || !proPriceId) {
      throw new Error("Missing STRIPE_STANDARD_PRICE_ID or STRIPE_PRO_PRICE_ID env var")
    }

    const priceId = String(plan || "standard").toLowerCase() === "pro" ? proPriceId : standardPriceId

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_creation: "always",
      success_url: `${baseUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing-cancelled`,
      allow_promotion_codes: true,
      metadata: { plan_requested: String(plan || "standard").toLowerCase() },
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create session" }, { status: 500 })
  }
}