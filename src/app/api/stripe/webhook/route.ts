import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { orders } from "@/db/schema";
import { db } from "@/lib/db";
import { completePaidOrder } from "@/lib/complete-order";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = Number(session.metadata?.order_id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) return NextResponse.json({ received: true });

  if (
    (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
    session.payment_status === "paid"
  ) {
    if (!await completePaidOrder(orderId, session)) {
      return NextResponse.json({ error: "Checkout amount did not match order." }, { status: 400 });
    }
  } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    await db.update(orders).set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.stripeCheckoutSessionId, session.id), eq(orders.status, "pending")));
  }

  return NextResponse.json({ received: true });
}
