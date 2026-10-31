"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { addBagItemAction, addBagItemsAction } from "@/app/bag/actions";
import { useBagCount, useCurrentAccount } from "@/app/cart-store";
import type { AssistantBagRequest, AssistantOrderPlan, AssistantProduct } from "@/lib/assistant-types";

type Product = AssistantProduct;
type Turn = { role: "user" | "assistant"; text: string; products?: Product[]; orderPlan?: AssistantOrderPlan };

function price(product: Product) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.priceCents / 100);
}

export function ShoppingAssistant() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { refreshBagCount } = useBagCount();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, turns, pending]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!pending) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  async function requestMessage(message: string, addUserTurn: boolean) {
    if (!message || pending) return;
    setNotice("");
    const recentTurns = turns.slice(-6);
    const history = (addUserTurn ? recentTurns : recentTurns.filter((turn, index) => !(index === recentTurns.length - 1 && turn.role === "user" && turn.text === message)))
      .map(({ role, text }) => ({ role, text }));
    if (addUserTurn) setTurns((current) => [...current, { role: "user", text: message }]);
    setRetryMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await response.json() as { message?: string; products?: Product[]; orderPlan?: AssistantOrderPlan; error?: string };
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable right now.");
      setTurns((current) => [...current, { role: "assistant", text: data.message || "Here are a few options to explore.", products: data.products || [], orderPlan: data.orderPlan }]);
      setDraft("");
      if (data.orderPlan?.lines.length && data.orderPlan.lines.every((line) => line.options.length === 1 || line.selectedSlug)) {
        await submitOrderPlan(data.orderPlan);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The assistant is unavailable right now. Please try again.");
      setRetryMessage(message);
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;
    await requestMessage(message, true);
  }

  async function addProduct(product: Product) {
    if (!account) {
      const params = new URLSearchParams({
        returnTo: `/products/${product.slug}`,
        addProduct: product.slug,
        addQuantity: "1",
      });
      router.push(`/sign-in?${params.toString()}`);
      return;
    }
    setNotice("");
    const result = await addBagItemAction(product.slug, 1);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    await refreshBagCount();
    setNotice(`${product.name} was added to your bag.`);
  }

  async function submitOrderPlan(plan: AssistantOrderPlan) {
    const requests: AssistantBagRequest[] = plan.lines.map((line) => ({
      productSlug: line.selectedSlug || line.options[0]?.slug || "",
      quantity: line.quantity,
    }));
    if (requests.some((item) => !item.productSlug)) return;
    if (!account) {
      const params = new URLSearchParams({ returnTo: "/checkout", pendingOrder: JSON.stringify(requests) });
      router.push(`/sign-in?${params.toString()}`);
      return;
    }
    setNotice("");
    setSubmittingOrder(true);
    const result = await addBagItemsAction(requests);
    if (!result.ok) {
      setNotice(result.error);
      setSubmittingOrder(false);
      return;
    }
    await refreshBagCount();
    router.push("/checkout?assistantOrder=ready");
  }

  function selectOrderOption(plan: AssistantOrderPlan, lineIndex: number, productSlug: string) {
    const updated: AssistantOrderPlan = {
      lines: plan.lines.map((line, index) => index === lineIndex ? { ...line, selectedSlug: productSlug } : line),
    };
    setTurns((current) => current.map((turn) => turn.orderPlan === plan ? { ...turn, orderPlan: updated } : turn));
    if (updated.lines.every((line) => line.options.length === 1 || line.selectedSlug)) void submitOrderPlan(updated);
  }

  return (
    <>
      <button className="assistant-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open shopping assistant">
        <span aria-hidden="true" className="assistant-launcher-mark">✳</span>
        <span>Ask Aurel</span>
      </button>
      {open && (
        <div className="assistant-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={panelRef} className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <header className="assistant-header">
              <div><p className="eyebrow">Personal shopping</p><h2 id="assistant-title">Ask Aurel</h2></div>
              <button className="assistant-close" type="button" aria-label="Close shopping assistant" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="assistant-conversation" aria-live="polite">
              {!turns.length && <div className="assistant-welcome"><p>Tell me what you’re looking for.</p><span>I can help explore the pieces currently in our collection and prepare your bag.</span></div>}
              {turns.map((turn, index) => (
                <article className={`assistant-turn assistant-turn--${turn.role}`} key={`${index}-${turn.role}`}>
                  <p className="assistant-turn-text">{turn.text}</p>
                  {turn.products?.length ? (
                    <div className="assistant-product-list">
                      {turn.products.map((product) => (
                        <article className="assistant-product" key={product.slug}>
                          <a href={`/products/${product.slug}`} className="assistant-product-image">
                            <Image src={product.imageUrl} alt={product.imageAlt} fill sizes="4rem" />
                          </a>
                          <div className="assistant-product-info">
                            <a href={`/products/${product.slug}`} className="assistant-product-name">{product.name}</a>
                            <span>{product.category} · {price(product)}</span>
                            <small>{product.stockQuantity > 0 ? "In stock" : "Out of stock"}</small>
                          </div>
                          {product.stockQuantity > 0 && <button type="button" className="assistant-add" onClick={() => void addProduct(product)}>Add</button>}
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {turn.orderPlan?.lines.map((line, lineIndex) => line.options.length > 1 && !line.selectedSlug ? (
                    <div className="assistant-product-list" key={`order-options-${lineIndex}`} aria-label={`Choose ${line.requestedTerm}`}>
                      <p className="assistant-order-choice">Choose which {line.requestedTerm} you mean · quantity {line.quantity}</p>
                      {line.options.map((product) => (
                        <article className="assistant-product" key={product.slug}>
                          <a href={`/products/${product.slug}`} className="assistant-product-image"><Image src={product.imageUrl} alt={product.imageAlt} fill sizes="4rem" /></a>
                          <div className="assistant-product-info"><a href={`/products/${product.slug}`} className="assistant-product-name">{product.name}</a><span>{product.category} · {price(product)}</span><small>{product.stockQuantity} available</small></div>
                          <button className="assistant-add" type="button" disabled={submittingOrder} onClick={() => selectOrderOption(turn.orderPlan!, lineIndex, product.slug)}>Choose</button>
                        </article>
                      ))}
                    </div>
                  ) : null)}
                  {turn.orderPlan?.lines.some((line) => line.options.length > 1 && !line.selectedSlug) && (
                    <p className="assistant-order-choice">Choose an item above to prepare your bag and continue.</p>
                  )}
                </article>
              ))}
              {pending && <p className="assistant-pending" role="status">
                {elapsedSeconds < 5 ? "Finding a thoughtful match…" : elapsedSeconds < 20 ? "Searching the collection…" : "This is taking longer than usual…"}
              </p>}
              <div ref={endRef} />
            </div>
            {(notice || submittingOrder) && <div className="assistant-notice" role="status"><span>{submittingOrder ? "Checking availability and preparing your bag…" : notice}</span>{retryMessage && <button className="text-link" type="button" onClick={() => void requestMessage(retryMessage, false)} disabled={pending}>Try again</button>}</div>}
            <form className="assistant-compose" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="assistant-message">Your message</label>
              <textarea id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Describe what you have in mind…" disabled={pending} />
              <div className="assistant-compose-footer"><span>{draft.length}/2,000</span><button className="button" disabled={pending || !draft.trim()} type="submit">Send</button></div>
            </form>
            <p className="assistant-footnote">Recommendations reflect details in our current catalog.</p>
          </section>
        </div>
      )}
    </>
  );
}
