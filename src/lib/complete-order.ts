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

  // Lock the order and all product rows before deciding whether every line can
  // be decremented. A single paid-order update records the stock-review flag;
  // the status guard makes webhook retries and the success-page fallback safe.
  await db.execute(sql`
    with order_context as materialized (
      select id, user_id
      from orders
      where id = ${orderId}
        and stripe_checkout_session_id = ${session.id}
        and status <> 'paid'
      for update
    ),
    locked_lines as materialized (
      select p.id as product_id, p.stock_quantity, oi.quantity
      from order_items oi
      join products p on p.id = oi.product_id
      join order_context oc on oc.id = oi.order_id
      order by p.id
      for update of p
    ),
    inventory_state as (
      select oc.id,
        (count(ll.product_id) = (select count(*) from order_items oi where oi.order_id = oc.id)
          and coalesce(bool_and(ll.stock_quantity >= ll.quantity), false)) as enough_stock
      from order_context oc
      left join locked_lines ll on true
      group by oc.id
    ),
    paid_order as (
      update orders o
      set status = 'paid',
          inventory_issue = not inventory_state.enough_stock,
          stripe_payment_intent_id = ${typeof session.payment_intent === "string" ? session.payment_intent : null},
          updated_at = now()
      from order_context oc, inventory_state
      where o.id = oc.id and inventory_state.id = oc.id
      returning o.id, o.user_id
    ),
    stock_update as (
      update products p
      set stock_quantity = p.stock_quantity - ll.quantity
      from locked_lines ll, paid_order po, inventory_state ist
      where p.id = ll.product_id and ist.id = po.id and ist.enough_stock
      returning p.id
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
