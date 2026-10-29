"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { addBagItemAction, getBagSummaryAction } from "@/app/bag/actions";

type CartContextValue = {
  itemCount: number;
  refreshBagCount: () => Promise<void>;
  user: { id: string; name: string | null; email: string; image?: string | null; role?: string | null } | null;
};

const CartContext = createContext<CartContextValue | null>(null);

type InitialSession = {
  user: { id: string; name: string | null; email: string; image?: string | null; role?: string | null };
} | null;

export function CartProvider({ children, initialSession = null }: { children: React.ReactNode; initialSession?: InitialSession }) {
  const { data: session, isPending } = authClient.useSession();
  const [itemCount, setItemCount] = useState(0);
  const currentSession = isPending ? initialSession : session;
  const userId = currentSession?.user.id;

  const refreshBagCount = useCallback(async () => {
    if (!userId) {
      setItemCount(0);
      return;
    }
    try {
      const result = await getBagSummaryAction();
      setItemCount(result.ok ? result.data.itemCount : 0);
    } catch {
      setItemCount(0);
    }
  }, [userId]);

  useEffect(() => {
    try {
      window.localStorage.removeItem("aurel-cart");
    } catch {
      // The bag is account-backed; storage may be unavailable in private contexts.
    }
  }, []);

  useEffect(() => {
    if (!isPending) void refreshBagCount();
  }, [isPending, refreshBagCount]);

  const value = useMemo(() => ({
    itemCount,
    refreshBagCount,
    user: currentSession?.user ?? null,
  }), [currentSession, itemCount, refreshBagCount]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("Cart controls must be used within CartProvider.");
  return context;
}

export function useBagCount() {
  return useCart();
}

export function useCurrentAccount() {
  return useCart().user;
}

export function CartCountLink({ className = "bag-link" }: { className?: string }) {
  const { itemCount } = useCart();
  return (
    <Link className={className} href="/bag" aria-label={`Shopping bag, ${itemCount} items`}>
      <span className="bag-label">Bag</span>
      <span className="bag-count">{itemCount}</span>
      <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none">
        <path d="M5.5 8h13l1 12h-15l1-12Z" stroke="currentColor" strokeWidth="1.25" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    </Link>
  );
}

export function ProductPurchasePanel({
  product,
  initialNotice,
}: {
  product: { slug: string; stockQuantity: number };
  initialNotice?: string;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { refreshBagCount } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState(() => initialNotice === "stock-changed"
    ? "Stock changed while you were signing in. Please choose an available quantity."
    : initialNotice === "unavailable"
      ? "This product could not be added. Please try again."
      : "");
  const [added, setAdded] = useState(initialNotice === "added");

  async function addToBag() {
    setMessage("");
    setAdded(false);

    if (!session?.user) {
      const params = new URLSearchParams({
        returnTo: `/products/${product.slug}`,
        addProduct: product.slug,
        addQuantity: String(quantity),
      });
      router.push(`/sign-in?${params.toString()}`);
      return;
    }

    setIsAdding(true);
    try {
      const result = await addBagItemAction(product.slug, quantity);
      if (result.ok) {
        setAdded(true);
        await refreshBagCount();
      } else {
        setMessage(result.error);
      }
    } catch {
      setMessage("We could not update your bag. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  const unavailable = product.stockQuantity <= 0;

  return (
    <div className="purchase-panel">
      <div className="quantity-control" aria-label="Quantity selector">
        <span className="quantity-label">Quantity</span>
        <div className="quantity-stepper">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity" disabled={quantity <= 1 || isAdding}>−</button>
          <output aria-live="polite" aria-label="Selected quantity">{quantity}</output>
          <button type="button" onClick={() => setQuantity((value) => Math.min(product.stockQuantity, 99, value + 1))} aria-label="Increase quantity" disabled={isAdding || quantity >= Math.min(product.stockQuantity, 99)}>+</button>
        </div>
      </div>
      <button className="button purchase-button" type="button" onClick={addToBag} disabled={isPending || isAdding || unavailable}>
        {unavailable ? "Out of stock" : isAdding ? "Adding…" : added ? "Added to bag" : "Add to bag"}
      </button>
      <p className="cart-feedback" role="status" aria-live="polite">
        {message || (added ? `${quantity} ${quantity === 1 ? "item" : "items"} added · Bag updated` : "")}
      </p>
    </div>
  );
}
