import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountControl } from "@/app/account-control";
import { CartCountLink } from "@/app/cart-store";
import { startCheckoutAction } from "@/app/checkout/actions";
import { getBagForUser, getCurrentUserId } from "@/lib/bag-service";

export const dynamic = "force-dynamic";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; error?: string; assistantOrder?: string; assistantOrderError?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in?returnTo=%2Fcheckout");
  const [bag, params] = await Promise.all([getBagForUser(userId), searchParams]);
  const checkoutEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <>
      <header className="site-header">
        <div className="nav-row page-shell bag-nav">
          <Link className="product-back text-link" href="/bag">← Return to bag</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="bag-header-actions"><AccountControl /><CartCountLink /></div>
        </div>
      </header>
      <main className="checkout-placeholder page-shell">
        <p className="eyebrow">Secure checkout · Test environment</p>
        <h1 className="type-display">A little closer to yours.</h1>
        {params.assistantOrder === "ready" && <p className="checkout-message" role="status">Your requested items are in your bag. Review the items and subtotal before continuing to secure payment.</p>}
        {params.assistantOrderError && <p className="checkout-message" role="alert">We couldn’t prepare the full order because availability changed or an item is no longer available. Review your bag and try again.</p>}
        {params.canceled === "1" && <p className="checkout-message" role="status">Payment was canceled. Your bag is still here.</p>}
        {params.error && <p className="checkout-message" role="alert">Checkout could not start. Please return to your bag and try again.</p>}
        {bag.items.length === 0 ? (
          <>
            <p>Your bag is empty. Add a piece before continuing to checkout.</p>
            <Link className="button button--outline" href="/new-arrivals">Explore new arrivals</Link>
          </>
        ) : (
          <>
            <section className="checkout-review" aria-label="Order summary">
              <h2>Your pieces</h2>
              {bag.items.map((item) => (
                <div className="checkout-review-row" key={item.id}>
                  <span>{item.name} <span className="checkout-quantity">× {item.quantity}</span></span>
                  <span>{formatPrice(item.priceCents * item.quantity, item.currency)}</span>
                </div>
              ))}
              <div className="checkout-review-total"><span>Subtotal</span><strong>{formatPrice(bag.subtotalCents, bag.currency)}</strong></div>
            </section>
            {bag.items.some((item) => item.stockQuantity < item.quantity) ? (
              <p className="checkout-message" role="alert">An item quantity exceeds current stock. Update your bag before checkout.</p>
            ) : checkoutEnabled ? (
              <form action={startCheckoutAction}>
                <button className="button checkout-pay-button" type="submit">Continue to secure payment</button>
              </form>
            ) : (
              <p className="checkout-message">Add a Stripe test secret key to <code>.env.local</code> to enable the payment demo.</p>
            )}
            <p className="checkout-test-note">Test mode only. No shipping or tax is collected in this demonstration.</p>
          </>
        )}
      </main>
    </>
  );
}
