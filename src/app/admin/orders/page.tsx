import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { orders } from "@/db/schema";
import { db } from "@/lib/db";
import { formatProductPrice } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const allOrders = await db.select({ id: orders.id, status: orders.status, subtotalCents: orders.subtotalCents, currency: orders.currency, createdAt: orders.createdAt, customer: user.name, email: user.email, inventoryIssue: orders.inventoryIssue })
    .from(orders).innerJoin(user, eq(orders.userId, user.id)).orderBy(desc(orders.createdAt));
  return <>
    <header className="admin-page-heading"><div><p className="eyebrow">Payments confirmed at checkout</p><h1 className="admin-title">Orders</h1></div><span>{allOrders.length} total</span></header>
    {allOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr></thead><tbody>{allOrders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}>#{order.id}</Link>{order.inventoryIssue && <span className="admin-issue">Stock review</span>}</td><td>{order.customer}<small>{order.email}</small></td><td>{order.createdAt.toLocaleString()}</td><td><span className={`admin-status admin-status--${order.status}`}>{order.status}</span></td><td>{formatProductPrice(order.subtotalCents, order.currency)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No orders have been placed yet.</p>}
  </>;
}
