"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getAssistantBagQuoteAction } from "@/app/bag/actions";
import { startCheckoutAction } from "@/app/checkout/actions";
import { useBagCount } from "@/app/cart-store";
import type { BagData } from "@/lib/bag-types";
import type { AssistantOrderPlan, AssistantProduct, AssistantProductGroup, AssistantSearchIntent } from "@/lib/assistant-types";

type Product = AssistantProduct;
type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  products?: Product[];
  productGroups?: AssistantProductGroup[];
  hasMore?: boolean;
  nextOffset?: number;
  searchIntent?: AssistantSearchIntent;
  queryText?: string;
  orderPlan?: AssistantOrderPlan;
  quote?: BagData;
};

function price(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function bagHasAvailableStock(bag: BagData) {
  return bag.items.every((item) => item.stockQuantity >= item.quantity);
}

function isCheckoutConfirmation(value: string) {
  return /^(?:(?:yes|okay|ok|confirm|please|now)[,\s]*)?(?:place|submit|confirm|complete)\s+(?:(?:the|an?)\s+)?order[.!\s]*$/i.test(value.trim()) ||
    /^(?:continue|go|proceed)\s+(?:to\s+)?(?:payment|checkout)[.!\s]*$/i.test(value.trim());
}

export function ShoppingAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const { refreshBagCount } = useBagCount();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoteSnapshot, setQuoteSnapshot] = useState<BagData | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(1);

  function appendAssistant(text: string, extras: Partial<Turn> = {}) {
    const id = nextTurnId.current++;
    setTurns((current) => [...current, { id, role: "assistant", text, ...extras }]);
  }

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, turns, pending, submittingOrder]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!pending) { setElapsedSeconds(0); return; }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    const resume = params.get("assistantResume");
    if (resume === "quote") {
      setOpen(true);
      setPending(true);
      void getAssistantBagQuoteAction().then((result) => {
        if (result.ok) {
          setQuoteReady(bagHasAvailableStock(result.data));
          setQuoteSnapshot(result.data);
          appendAssistant(bagHasAvailableStock(result.data)
            ? "You’re signed in. Here is the current total for your bag. Say “place order” when you are ready to continue to payment."
            : "You’re signed in. Here is the current total, but stock has changed for one or more items. Update the quantities in your bag before placing the order.", { quote: result.data });
        } else {
          setNotice(result.error);
        }
      }).catch(() => setNotice("I couldn’t load your bag total. Please try again.")).finally(() => setPending(false));
      router.replace("/");
    } else if (resume === "error") {
      setOpen(true);
      setNotice(params.get("assistantOrderError") === "stock" ? "Stock changed while you were signing in. Nothing was added; please choose an available quantity." : "I couldn’t add those items. Please search again and retry.");
      router.replace("/");
    } else if (resume === "chat") {
      setOpen(true);
      setPending(true);
      router.replace("/");
      void fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "resume purchase" }),
      }).then(async (response) => {
        const data = await response.json() as { message?: string; quote?: BagData; error?: string };
        if (!response.ok) throw new Error(data.error || "The assistant could not resume your request.");
        appendAssistant(data.message || "Your request is ready to continue.", data.quote ? { quote: data.quote } : {});
        if (data.quote) {
          setQuoteReady(bagHasAvailableStock(data.quote));
          setQuoteSnapshot(data.quote);
          void refreshBagCount();
        }
      }).catch((error) => setNotice(error instanceof Error ? error.message : "The assistant could not resume your request."))
        .finally(() => setPending(false));
    }
  }, [pathname, refreshBagCount, router]);

  async function resetConversation() {
    if (pending || submittingOrder) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/assistant/chat", { method: "DELETE" });
      if (!response.ok) throw new Error("The conversation could not be reset.");
      setTurns([]);
      setQuoteReady(false);
      setQuoteSnapshot(null);
      setRetryMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The conversation could not be reset.");
    } finally {
      setPending(false);
    }
  }

  async function startPayment() {
    if (!quoteReady || submittingOrder) return;
    setNotice("");
    setSubmittingOrder(true);
    try {
      const current = await getAssistantBagQuoteAction();
      if (!current.ok) {
        setQuoteReady(false);
        if (current.code === "UNAUTHENTICATED") {
          router.push("/sign-in?" + new URLSearchParams({ returnTo: "/?assistantResume=quote" }).toString());
          return;
        }
        appendAssistant(current.error);
        return;
      }
      const wasUnchanged = quoteSnapshot && quoteSnapshot.currency === current.data.currency && quoteSnapshot.subtotalCents === current.data.subtotalCents &&
        quoteSnapshot.items.length === current.data.items.length && quoteSnapshot.items.every((item) => {
          const latest = current.data.items.find((candidate) => candidate.productSlug === item.productSlug);
          return latest?.quantity === item.quantity && latest.priceCents === item.priceCents && latest.stockQuantity === item.stockQuantity;
        });
      if (!wasUnchanged) {
        setQuoteSnapshot(current.data);
        setQuoteReady(bagHasAvailableStock(current.data));
        appendAssistant(bagHasAvailableStock(current.data)
          ? "Your bag changed since I showed the bill. Please review this updated total and confirm again."
          : "Stock changed since I showed the bill. Review the updated bag and correct the quantities before placing the order.", { quote: current.data });
        return;
      }
      await startCheckoutAction();
    } catch {
      appendAssistant("I couldn’t open the payment page. Your bag is still available; please try again.");
      setSubmittingOrder(false);
    }
  }

  async function requestMessage(message: string, addUserTurn = true, continuation?: { intent: AssistantSearchIntent; offset: number }, selectionSlug?: string) {
    if (!message || pending || submittingOrder) return;
    setNotice("");
    const recentTurns = turns.slice(-6);
    const history = recentTurns.map(({ role, text }) => ({ role, text }));
    if (addUserTurn) setTurns((current) => [...current, { id: nextTurnId.current++, role: "user", text: message }]);
    setRetryMessage("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, ...(continuation ? { continuation } : {}), ...(selectionSlug ? { selectionSlug } : {}) }),
      });
      const data = await response.json() as {
        message?: string; products?: Product[]; orderPlan?: AssistantOrderPlan; error?: string;
        productGroups?: AssistantProductGroup[];
        hasMore?: boolean; nextOffset?: number; searchIntent?: AssistantSearchIntent;
        quote?: BagData; requiresSignIn?: boolean;
      };
      if (!response.ok) throw new Error(data.error || "The assistant is unavailable right now.");
      if (data.requiresSignIn) {
        router.push("/sign-in?" + new URLSearchParams({ returnTo: "/?assistantResume=chat" }).toString());
        return;
      }
      const id = nextTurnId.current++;
      setTurns((current) => [...current, {
        id, role: "assistant", text: data.message || "Here are a few pieces to explore.",
        products: data.products || [], productGroups: data.productGroups, orderPlan: data.orderPlan, hasMore: data.hasMore,
        nextOffset: data.nextOffset, searchIntent: data.searchIntent, queryText: message, quote: data.quote,
      }]);
      setDraft("");
      if (data.quote) {
        setQuoteReady(bagHasAvailableStock(data.quote));
        setQuoteSnapshot(data.quote);
        await refreshBagCount();
      } else if (data.orderPlan) {
        setQuoteReady(false);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The assistant is unavailable right now. Please try again.");
      setRetryMessage(/\b(?:order|add|buy|purchase)\b/i.test(message) ? "resume purchase" : message);
    } finally {
      setPending(false);
    }
  }

  async function loadMore(group: AssistantProductGroup) {
    if (!group.hasMore || group.nextOffset === undefined) return;
    await requestMessage("Show me more", true, { intent: group.searchIntent, offset: group.nextOffset });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending || submittingOrder) return;
    setTurns((current) => [...current, { id: nextTurnId.current++, role: "user", text: message }]);
    setDraft("");

    if (quoteReady && isCheckoutConfirmation(message)) {
      await startPayment();
      return;
    }
    await requestMessage(message, false);
  }

  function selectFromSearch(product: Product) {
    void requestMessage("Add " + product.name, true);
  }

  const latestQuoteTurnId = turns.reduce((latest, turn) => turn.quote ? Math.max(latest, turn.id) : latest, 0);

  return (
    <>
      <button className="assistant-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open shopping assistant">
        <span aria-hidden="true" className="assistant-launcher-mark">✳</span><span>Ask Aurel</span>
      </button>
      {open && (
        <div className="assistant-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={panelRef} className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <header className="assistant-header">
              <div><p className="eyebrow">Personal shopping</p><h2 id="assistant-title">Ask Aurel</h2></div>
              <button className="assistant-new-chat" type="button" onClick={() => void resetConversation()} disabled={pending || submittingOrder}>New chat</button>
              <button className="assistant-close" type="button" aria-label="Close shopping assistant" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="assistant-conversation" aria-live="polite">
              {!turns.length && <div className="assistant-welcome"><p>Tell me what you’re looking for.</p><span>I can help explore the collection, prepare your bag, and take you to secure payment.</span></div>}
              {turns.map((turn) => (
                <article className={"assistant-turn assistant-turn--" + turn.role} key={turn.id}>
                  <p className="assistant-turn-text">{turn.text}</p>
                  {turn.productGroups?.map((group) => (
                    <section className="assistant-search-group" key={group.categorySlug} aria-label={group.categoryName + " results"}>
                      <h3 className="assistant-search-group-title">{group.categoryName}</h3>
                      {group.products.length ? (
                        <div className="assistant-product-list">
                          {group.products.map((product) => (
                            <article className="assistant-product" key={product.slug}>
                              <a href={"/products/" + product.slug} className="assistant-product-image"><Image src={product.imageUrl} alt={product.imageAlt} fill sizes="4rem" /></a>
                              <div className="assistant-product-info">
                                <a href={"/products/" + product.slug} className="assistant-product-name">{product.name}</a>
                                <span>{product.category} · {price(product.priceCents, product.currency)}</span>
                                <small>{product.stockQuantity > 0 ? product.stockQuantity + " in stock" : "Out of stock"}</small>
                                {product.reviewHighlights?.map((highlight, index) => <small className="assistant-review-highlight" key={index}>“{highlight}” · approved review</small>)}
                              </div>
                              {product.stockQuantity > 0 && <button type="button" className="assistant-add" disabled={pending || submittingOrder} onClick={() => selectFromSearch(product)}>Select</button>}
                            </article>
                          ))}
                        </div>
                      ) : <p className="assistant-order-choice">No in-stock items were found in this collection.</p>}
                      {group.hasMore && <button type="button" className="text-link assistant-show-more" disabled={pending} onClick={() => void loadMore(group)}>Show more {group.categoryName.toLowerCase()}</button>}
                    </section>
                  ))}
                  {turn.orderPlan?.lines.map((line) => (
                    <div className="assistant-product-list" key={"order-options-" + line.requestedTerm} aria-label={"Choose " + line.requestedTerm}>
                      <p className="assistant-order-choice">{line.quantity ? "Quantity " + line.quantity + " · " : ""}Choose the exact product for “{line.requestedTerm}”</p>
                      {line.options.length === 0 && <>
                        <p className="assistant-order-choice">No matching in-stock product was found for this item.</p>
                        <button type="button" className="text-link assistant-skip-item" disabled={pending} onClick={() => void requestMessage("Skip this unavailable item", true)}>Skip this item</button>
                      </>}
                      {line.options.map((product) => (
                        <article className="assistant-product" key={product.slug}>
                          <a href={"/products/" + product.slug} className="assistant-product-image"><Image src={product.imageUrl} alt={product.imageAlt} fill sizes="4rem" /></a>
                          <div className="assistant-product-info"><a href={"/products/" + product.slug} className="assistant-product-name">{product.name}</a><span>{product.category} · {price(product.priceCents, product.currency)}</span><small>{product.stockQuantity} in stock</small>{product.reviewHighlights?.map((highlight, index) => <small className="assistant-review-highlight" key={index}>“{highlight}” · approved review</small>)}</div>
                          <button className="assistant-add" type="button" disabled={pending || submittingOrder || line.selectedSlug === product.slug} onClick={() => void requestMessage("Select " + product.name, true, undefined, product.slug)}>
                            {line.selectedSlug === product.slug ? "Selected" : "Select"}
                          </button>
                        </article>
                      ))}
                    </div>
                  ))}
                  {turn.quote && (
                    <section className="assistant-quote" aria-label="Current bag bill">
                      <p className="eyebrow">Your bag · Current catalog prices</p>
                      {turn.quote.items.map((item) => (
                        <div className="assistant-quote-row" key={item.id}>
                          <span>{item.name} × {item.quantity}</span><span>{price(item.priceCents * item.quantity, item.currency)}</span>
                        </div>
                      ))}
                      <div className="assistant-quote-total"><strong>Subtotal</strong><strong>{price(turn.quote.subtotalCents, turn.quote.currency)}</strong></div>
                      {turn.id === latestQuoteTurnId && <button className="button assistant-order-confirm" type="button" disabled={!quoteReady || submittingOrder} onClick={() => void startPayment()}>Place order · Continue to payment</button>}
                    </section>
                  )}
                  {turn.hasMore && <button type="button" className="text-link assistant-show-more" disabled={pending} onClick={() => void loadMore({ categorySlug: "", categoryName: "Results", products: turn.products ?? [], hasMore: true, nextOffset: turn.nextOffset, searchIntent: turn.searchIntent! })}>Show more results</button>}
                </article>
              ))}
              {pending && <p className="assistant-pending" role="status">{elapsedSeconds < 5 ? "Finding a thoughtful match…" : elapsedSeconds < 20 ? "Searching the collection…" : "This is taking longer than usual…"}</p>}
              <div ref={endRef} />
            </div>
            {(notice || submittingOrder) && <div className="assistant-notice" role="status"><span>{submittingOrder ? "Checking availability…" : notice}</span>{retryMessage && <button className="text-link" type="button" onClick={() => void requestMessage(retryMessage, false)} disabled={pending}>Try again</button>}</div>}
            <form className="assistant-compose" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="assistant-message">Your message</label>
              <textarea id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder={quoteReady ? "Ask about another item or say “place order”…" : "Describe what you have in mind…"} disabled={pending || submittingOrder} />
              <div className="assistant-compose-footer"><span>{draft.length}/2,000</span><button className="button" disabled={pending || submittingOrder || !draft.trim()} type="submit">Send</button></div>
            </form>
            <p className="assistant-footnote">Recommendations and totals use details in Aurel’s current catalog. Payment is handled securely by Stripe.</p>
          </section>
        </div>
      )}
    </>
  );
}
