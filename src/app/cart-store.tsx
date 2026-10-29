"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: string;
  image: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "aurel-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed as CartItem[]);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  function addItem(item: Omit<CartItem, "quantity">, quantity: number) {
    setItems((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (!existing) return [...current, { ...item, quantity }];
      return current.map((entry) =>
        entry.id === item.id ? { ...entry, quantity: entry.quantity + quantity } : entry,
      );
    });
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const value = useMemo(() => ({ items, itemCount, addItem }), [items, itemCount]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("Cart controls must be used within CartProvider.");
  return context;
}

export function CartCountLink({ className = "bag-link" }: { className?: string }) {
  const { itemCount } = useCart();
  return (
    <Link className={className} href="/#new-arrivals" aria-label={`Shopping bag, ${itemCount} items`}>
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
}: {
  product: Omit<CartItem, "quantity">;
}) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  function addToCart() {
    addItem(product, quantity);
    setAdded(true);
  }

  return (
    <div className="purchase-panel">
      <div className="quantity-control" aria-label="Quantity selector">
        <span className="quantity-label">Quantity</span>
        <div className="quantity-stepper">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity" disabled={quantity <= 1}>−</button>
          <output aria-live="polite" aria-label="Selected quantity">{quantity}</output>
          <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Increase quantity">+</button>
        </div>
      </div>
      <button className="button purchase-button" type="button" onClick={addToCart}>
        {added ? "Added to bag" : "Add to bag"}
      </button>
      <p className="cart-feedback" role="status" aria-live="polite">
        {added ? `${quantity} ${quantity === 1 ? "item" : "items"} added · Bag updated` : ""}
      </p>
    </div>
  );
}
