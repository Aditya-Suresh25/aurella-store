import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { orderItems, orders } from "@/db/schema";
import { db } from "@/lib/db";
import { formatProductPrice } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const [result, lines] = await Promise.all([
    db.select({ id: orders.id, status: orders.status, inventoryIssue: orders.inventoryIssue, subtotalCents: orders.subtotalCents, currency: orders.currency, createdAt: orders.createdAt, customer: user.name, email: user.email })
      .from(orders).innerJoin(user, eq(orders.userId, user.id)).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
  ]);
  const order = result[0];
  if (!order) notFound();
  return <>
    <nav className="product-breadcrumb"><Link href="/admin/orders">Orders</Link><span>/</span><span>#{order.id}</span></nav>
    <header className="admin-page-heading"><div><p className="eyebrow">Order details</p><h1 className="admin-title">Order #{order.id}</h1></div><span className={`admin-status admin-status--${order.status}`}>{order.status}</span></header>
    {order.inventoryIssue && <p className="admin-alert" role="status">Payment completed, but stock could not be fully deducted. Review the inventory for this order.</p>}
    <section className="admin-order-meta"><div><span>Customer</span><strong>{order.customer}</strong><small>{order.email}</small></div><div><span>Placed</span><strong>{order.createdAt.toLocaleString()}</strong></div><div><span>Payment status</span><strong>{order.status}</strong><small>Payment status is controlled by the payment provider.</small></div></section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Purchased items</p><h2>Order contents</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Unit price</th><th>Quantity</th><th>Line total</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td>{line.productName}<small>{line.productSlug}</small></td><td>{formatProductPrice(line.unitPriceCents, line.currency)}</td><td>{line.quantity}</td><td>{formatProductPrice(line.unitPriceCents * line.quantity, line.currency)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Subtotal</th><th>{formatProductPrice(order.subtotalCents, order.currency)}</th></tr></tfoot></table></div>
    </section>
  </>;
}
