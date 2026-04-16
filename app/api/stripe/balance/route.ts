import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const balance = await stripe.balance.retrieve();

    return NextResponse.json({
      available: balance.available,
      pending: balance.pending,
    });
  } catch (err) {
    console.error("[stripe/balance] GET error:", err);
    return NextResponse.json({ error: "Failed to retrieve balance" }, { status: 500 });
  }
}
