"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AccountControl } from "@/app/account-control";
import { CartCountLink, useBagCount } from "@/app/cart-store";
import { removeBagItemAction, setBagItemQuantityAction } from "@/app/bag/actions";
import type { BagData } from "@/lib/bag-types";

function price(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function BagClient({ initialBag }: { initialBag: BagData }) {
  const [bag, setBag] = useState(initialBag);
  const [pendingSlug, setPendingSlug] = useState("");
  const [error, setError] = useState("");
  const { refreshBagCount } = useBagCount();

  async function updateQuantity(slug: string, quantity: number) {
    setPendingSlug(slug);
    setError("");
    try {
      const result = await setBagItemQuantityAction(slug, quantity);
      if (result.ok) {
        setBag(result.data);
        await refreshBagCount();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Your bag could not be updated. Please try again.");
    } finally {
      setPendingSlug("");
    }
  }

  async function removeItem(slug: string) {
    setPendingSlug(slug);
    setError("");
    try {
      const result = await removeBagItemAction(slug);
      if (result.ok) {
        setBag(result.data);
        await refreshBagCount();
      } else {
        setError(result.error);
      }
    } catch {
      setError("This item could not be removed. Please try again.");
    } finally {
      setPendingSlug("");
    }
  }

  const hasUnavailableItems = bag.items.some((item) => item.stockQuantity === 0 || item.quantity > item.stockQuantity);

  return (
    <>
      <header className="site-header">
        <div className="nav-row page-shell bag-nav">
          <Link className="product-back text-link" href="/new-arrivals">← Continue exploring</Link>
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <div className="bag-header-actions"><AccountControl /><CartCountLink /></div>
        </div>
      </header>

      <main className="bag-page page-shell">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Your bag</span>
        </nav>
        <div className="bag-heading">
          <div>
            <p className="eyebrow">A considered collection</p>
            <h1 className="type-display bag-title">Your bag</h1>
          </div>
          <p className="bag-count-summary">{bag.itemCount} {bag.itemCount === 1 ? "piece" : "pieces"}</p>
        </div>

        {error && <p className="bag-error" role="alert">{error}</p>}

        {bag.items.length === 0 ? (
          <section className="bag-empty">
            <p className="bag-empty-title">Your bag is taking a quiet moment.</p>
            <p>Pieces you choose will be gathered here for you.</p>
            <Link className="button button--outline" href="/new-arrivals">Discover new arrivals</Link>
          </section>
        ) : (
          <div className="bag-layout">
            <section className="bag-items" aria-label="Items in your bag">
              {bag.items.map((item) => {
                const unavailable = item.stockQuantity === 0 || item.quantity > item.stockQuantity;
                const pending = pendingSlug === item.productSlug;
                return (
                  <article className="bag-item" key={item.id}>
                    <Link className="bag-item-image" href={`/products/${item.productSlug}`} aria-label={`View ${item.name}`}>
                      <Image src={item.imageUrl} alt={item.imageAlt} fill sizes="(max-width: 767px) 34vw, 10rem" />
                    </Link>
                    <div className="bag-item-details">
                      <Link className="eyebrow bag-item-category" href={`/collections/${item.categorySlug}`}>{item.categoryName}</Link>
                      <Link className="bag-item-name" href={`/products/${item.productSlug}`}>{item.name}</Link>
                      <p className="bag-item-unit-price">{price(item.priceCents, item.currency)}</p>
                      <p className={`bag-item-stock${unavailable ? " bag-item-stock--unavailable" : ""}`}>
                        {unavailable ? (item.stockQuantity === 0 ? "Out of stock" : `Only ${item.stockQuantity} available`) : item.stockQuantity <= 5 ? `Low stock · ${item.stockQuantity} available` : "In stock"}
                      </p>
                      <div className="bag-item-controls">
                        <div className="quantity-stepper" aria-label={`Quantity of ${item.name}`}>
                          <button type="button" aria-label={`Decrease ${item.name}`} disabled={pending || item.quantity <= 1} onClick={() => void updateQuantity(item.productSlug, item.quantity - 1)}>−</button>
                          <output aria-live="polite" aria-label="Quantity">{item.quantity}</output>
                          <button type="button" aria-label={`Increase ${item.name}`} disabled={pending || item.quantity >= Math.min(item.stockQuantity, 99)} onClick={() => void updateQuantity(item.productSlug, item.quantity + 1)}>+</button>
                        </div>
                        <button className="bag-remove" type="button" disabled={pending} onClick={() => void removeItem(item.productSlug)}>
                          {pending ? "Updating…" : "Remove"}
                        </button>
                      </div>
                    </div>
                    <p className="bag-item-total">{price(item.priceCents * item.quantity, item.currency)}</p>
                  </article>
                );
              })}
            </section>

            <aside className="bag-summary" aria-label="Order summary">
              <h2>Summary</h2>
              <div><span>Items ({bag.itemCount})</span><span>{price(bag.subtotalCents, bag.currency)}</span></div>
              <div className="bag-subtotal"><span>Subtotal</span><span>{price(bag.subtotalCents, bag.currency)}</span></div>
              <p>Shipping and taxes are calculated at checkout.</p>
              {hasUnavailableItems ? (
                <button className="button bag-checkout-button" type="button" disabled>Proceed to checkout</button>
              ) : (
                <Link className="button bag-checkout-button" href="/checkout">Proceed to checkout</Link>
              )}
              {hasUnavailableItems && <p className="bag-summary-note">Adjust unavailable items before continuing.</p>}
              <Link className="bag-continue-link" href="/new-arrivals">Continue shopping</Link>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
