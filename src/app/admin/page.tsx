import Link from "next/link";
import { and, count, desc, eq, lte } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { categories, orders, products } from "@/db/schema";
import { db } from "@/lib/db";
import { formatProductPrice } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [activeProducts, activeCategories, lowStock, pendingOrders, paidOrders, recent] = await Promise.all([
    db.select({ total: count() }).from(products).where(eq(products.isActive, true)),
    db.select({ total: count() }).from(categories).where(eq(categories.isActive, true)),
    db.select({ total: count() }).from(products).where(and(eq(products.isActive, true), lte(products.stockQuantity, 5))),
    db.select({ total: count() }).from(orders).where(eq(orders.status, "pending")),
    db.select({ total: count() }).from(orders).where(eq(orders.status, "paid")),
    db.select({ id: orders.id, status: orders.status, subtotalCents: orders.subtotalCents, currency: orders.currency, createdAt: orders.createdAt, customer: user.name, email: user.email, inventoryIssue: orders.inventoryIssue })
      .from(orders).innerJoin(user, eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(6),
  ]);
  const cards = [["Active products", activeProducts[0].total, "/admin/products"], ["Active categories", activeCategories[0].total, "/admin/categories"], ["Low / out of stock", lowStock[0].total, "/admin/products"], ["Pending orders", pendingOrders[0].total, "/admin/orders"], ["Paid orders", paidOrders[0].total, "/admin/orders"]] as const;
  return <>
    <header className="admin-page-heading"><div><p className="eyebrow">Store overview</p><h1 className="admin-title">Dashboard</h1></div><Link className="button button--outline" href="/">View storefront</Link></header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <section className="admin-metric-grid" aria-label="Store counts">{cards.map(([label, value, href]) => <Link href={href} className="admin-metric" key={label}><span>{label}</span><strong>{value}</strong></Link>)}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent orders</h2></div><Link className="text-link" href="/admin/orders">All orders →</Link></div>
      {recent.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th></tr></thead><tbody>{recent.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`}>#{order.id}</Link>{order.inventoryIssue && <span className="admin-issue">Review stock</span>}</td><td>{order.customer}<small>{order.email}</small></td><td>{order.createdAt.toLocaleDateString()}</td><td><span className={`admin-status admin-status--${order.status}`}>{order.status}</span></td><td>{formatProductPrice(order.subtotalCents, order.currency)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">No orders have been placed yet.</p>}
    </section>
  </>;
}
