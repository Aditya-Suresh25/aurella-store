import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AccountControl } from "@/app/account-control";
import { CartCountLink } from "@/app/cart-store";
import { orderItems, orders } from "@/db/schema";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/bag-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your orders — Aurel",
  description: "View your Aurel order history and payment status.",
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function statusLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "failed") return "Payment issue";
  return "Processing";
}

export default async function OrdersPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in?returnTo=%2Forders");

  const userOrders = await db.select({
    id: orders.id,
    status: orders.status,
    subtotalCents: orders.subtotalCents,
    currency: orders.currency,
    createdAt: orders.createdAt,
    itemId: orderItems.id,
    productSlug: orderItems.productSlug,
    productName: orderItems.productName,
    imageUrl: orderItems.imageUrl,
    unitPriceCents: orderItems.unitPriceCents,
    quantity: orderItems.quantity,
    itemCurrency: orderItems.currency,
  })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt), desc(orders.id));

  const groupedOrders = new Map<number, {
    id: number;
    status: string;
    subtotalCents: number;
    currency: string;
    createdAt: Date;
    items: { id: number; productSlug: string; productName: string; imageUrl: string; unitPriceCents: number; quantity: number; currency: string }[];
  }>();

  for (const row of userOrders) {
    let order = groupedOrders.get(row.id);
    if (!order) {
      order = {
        id: row.id,
        status: row.status,
        subtotalCents: row.subtotalCents,
        currency: row.currency.toUpperCase(),
        createdAt: row.createdAt,
        items: [],
      };
      groupedOrders.set(row.id, order);
    }
    if (row.itemId && row.productSlug && row.productName && row.imageUrl && row.itemCurrency) {
      order.items.push({
        id: row.itemId,
        productSlug: row.productSlug,
        productName: row.productName,
        imageUrl: row.imageUrl,
        unitPriceCents: row.unitPriceCents ?? 0,
        quantity: row.quantity ?? 0,
        currency: row.itemCurrency.toUpperCase(),
      });
    }
  }

  const orderList = [...groupedOrders.values()];

  return (
    <>
      <header className="site-header">
        <div className="nav-row page-shell bag-nav">
          <Link className="product-back text-link" href="/new-arrivals">← Continue exploring</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="bag-header-actions"><AccountControl /><CartCountLink /></div>
        </div>
      </header>
      <main className="orders-page page-shell">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Your orders</span>
        </nav>
        <div className="orders-heading">
          <div>
            <p className="eyebrow">Your Aurel account</p>
            <h1 className="type-display">Your orders</h1>
          </div>
          {orderList.length > 0 && <p className="orders-count">{orderList.length} {orderList.length === 1 ? "order" : "orders"}</p>}
        </div>

        {orderList.length === 0 ? (
          <section className="orders-empty">
            <p className="orders-empty-title">Your story with us starts here.</p>
            <p>Orders you place will be gathered here for easy reference.</p>
            <Link className="button button--outline" href="/new-arrivals">Discover new arrivals</Link>
          </section>
        ) : (
          <section className="orders-list" aria-label="Order history">
            {orderList.map((order) => (
              <article className="order-card" key={order.id}>
                <header className="order-card-header">
                  <div>
                    <p className="eyebrow">Order No. {order.id}</p>
                    <p className="order-date">Placed {formatDate(order.createdAt)}</p>
                  </div>
                  <span className={`order-status${order.status === "paid" ? " order-status--paid" : order.status === "failed" ? " order-status--failed" : ""}`}>
                    {statusLabel(order.status)}
                  </span>
                </header>
                <div className="order-items">
                  {order.items.map((item) => (
                    <article className="order-item" key={item.id}>
                      <Link className="order-item-image" href={`/products/${item.productSlug}`} aria-label={`View ${item.productName}`}>
                        <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 22vw, 6rem" />
                      </Link>
                      <div className="order-item-copy">
                        <Link href={`/products/${item.productSlug}`}>{item.productName}</Link>
                        <p>Quantity · {item.quantity}</p>
                      </div>
                      <p className="order-item-total">{formatPrice(item.unitPriceCents * item.quantity, item.currency)}</p>
                    </article>
                  ))}
                </div>
                <footer className="order-card-footer">
                  <span>Items subtotal</span>
                  <strong>{formatPrice(order.subtotalCents, order.currency)}</strong>
                </footer>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
