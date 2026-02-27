import { NextResponse } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const STANDARD = process.env.STRIPE_STANDARD_PRICE_ID!
const PRO = process.env.STRIPE_PRO_PRICE_ID!

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get("session_id")
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    })

    if (session.status !== "complete") {
      return NextResponse.json({ error: "Checkout not complete" }, { status: 400 })
    }

    // Use Checkout-collected fields (avoids Customer | DeletedCustomer typing issues)
    const email = session.customer_details?.email ?? null
    const name = session.customer_details?.name ?? null

    const priceId = session.line_items?.data?.[0]?.price?.id ?? null

    let plan: "standard" | "pro" = "standard"
    if (priceId === PRO) plan = "pro"
    if (priceId === STANDARD) plan = "standard"

    return NextResponse.json({
      data: {
        session_id: session.id,
        email,
        name,
        plan,
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to fetch session" },
      { status: 500 }
    )
  }
}