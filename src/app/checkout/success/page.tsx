import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { AccountControl } from "@/app/account-control";
import { CartCountLink } from "@/app/cart-store";
import { RefreshBagCount } from "@/app/checkout/success/refresh-bag-count";
import { orders } from "@/db/schema";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/bag-service";
import { completePaidOrder } from "@/lib/complete-order";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in?returnTo=%2Fbag");
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) notFound();

  const [order] = await db.select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) notFound();

  // The session ID came from the browser, so verify that Stripe issued it and
  // that this signed-in customer owns the local order before showing a status.
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.order_id !== String(order.id)) notFound();
  const paid = session.payment_status === "paid";
  if (paid) await completePaidOrder(order.id, session);

  return (
    <>
      {paid && <RefreshBagCount />}
      <header className="site-header">
        <div className="nav-row page-shell bag-nav">
          <Link className="product-back text-link" href="/bag">← Return to bag</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="bag-header-actions"><AccountControl /><CartCountLink /></div>
        </div>
      </header>
      <main className="checkout-placeholder page-shell">
        <p className="eyebrow">{paid ? "Payment confirmed" : "Payment update"}</p>
        <h1 className="type-display">{paid ? "Thank you for your order." : "Your payment is processing."}</h1>
        <p>{paid
          ? `Your test payment is verified with Stripe. Order reference ${order.id}.`
          : "Stripe has not confirmed payment yet. You can check your bag or return shortly."}</p>
        <Link className="button button--outline" href={paid ? "/new-arrivals" : "/bag"}>{paid ? "Continue exploring" : "Return to your bag"}</Link>
      </main>
    </>
  );
}
