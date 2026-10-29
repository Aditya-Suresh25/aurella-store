import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { orders } from "@/db/schema";
import { db } from "@/lib/db";

export async function completePaidOrder(orderId: number, session: Stripe.Checkout.Session) {
  const [order] = await db.select({ id: orders.id, subtotalCents: orders.subtotalCents, currency: orders.currency })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.stripeCheckoutSessionId, session.id)))
    .limit(1);

  if (
    !order ||
    session.payment_status !== "paid" ||
    session.amount_total !== order.subtotalCents ||
    session.currency !== order.currency
  ) return false;

  // The status guard makes webhook retries and the success-page fallback safe.
  // Remove purchased quantities only; items added while Checkout was open remain.
  await db.execute(sql`
    with paid_order as (
      update orders
      set status = 'paid',
          stripe_payment_intent_id = ${typeof session.payment_intent === "string" ? session.payment_intent : null},
          updated_at = now()
      where id = ${orderId}
        and stripe_checkout_session_id = ${session.id}
        and status <> 'paid'
      returning id, user_id
    ),
    removed_items as (
      delete from cart_items ci
      using carts c, order_items oi, paid_order po
      where c.user_id = po.user_id
        and ci.cart_id = c.id
        and ci.product_id = oi.product_id
        and oi.order_id = po.id
        and ci.quantity <= oi.quantity
      returning ci.id
    ),
    reduced_items as (
      update cart_items ci
      set quantity = ci.quantity - oi.quantity, updated_at = now()
      from carts c, order_items oi, paid_order po
      where c.user_id = po.user_id
        and ci.cart_id = c.id
        and ci.product_id = oi.product_id
        and oi.order_id = po.id
        and ci.quantity > oi.quantity
      returning ci.id
    )
    select id from paid_order
  `);
  return true;
}
