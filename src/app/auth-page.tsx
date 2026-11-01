import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/app/auth-form";
import { safeReturnPath } from "@/lib/safe-return-path";
import type { AssistantBagRequest } from "@/lib/assistant-types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AuthPage({ mode, searchParams = {} }: { mode: "sign-in" | "sign-up"; searchParams?: SearchParams }) {
  const isSignUp = mode === "sign-up";
  const returnTo = safeReturnPath(first(searchParams.returnTo));
  const addProduct = first(searchParams.addProduct);
  const rawQuantity = Number(first(searchParams.addQuantity));
  const pendingAdd = addProduct && /^[a-z0-9-]+$/.test(addProduct) && Number.isSafeInteger(rawQuantity) && rawQuantity > 0 && rawQuantity <= 99
    ? { productSlug: addProduct, quantity: rawQuantity }
    : undefined;
  let pendingOrder: AssistantBagRequest[] | undefined;
  try {
    const parsed: unknown = JSON.parse(first(searchParams.pendingOrder) || "null");
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 6 && parsed.every((item) =>
      item && typeof item === "object" && "productSlug" in item && typeof item.productSlug === "string" && /^[a-z0-9-]{1,100}$/.test(item.productSlug) &&
      "quantity" in item && Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99
    )) pendingOrder = parsed as AssistantBagRequest[];
  } catch {
    pendingOrder = undefined;
  }

  return (
    <main className="auth-page">
      <aside className="auth-visual" aria-label="Aurel collection">
        <Image
          src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=90"
          alt="A model in a relaxed, colorful seasonal look"
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
        />
        <div className="auth-visual-shade" />
        <div className="auth-visual-copy">
          <p className="eyebrow">Aurel · Spring / Summer</p>
          <p className="auth-visual-title">Well made things for the everyday.</p>
        </div>
      </aside>

      <section className="auth-panel" aria-labelledby="auth-title">
        <header className="auth-header">
          <Link className="wordmark" href="/" aria-label="Aurel home">AUREL</Link>
          <Link className="auth-back-link" href="/">Return to the collection <span aria-hidden="true">↗</span></Link>
        </header>

        <div className="auth-content">
          <p className="eyebrow">Your account</p>
          <h1 className="auth-title" id="auth-title">
            {isSignUp ? "A place for your favorites." : "Welcome back."}
          </h1>
          <p className="auth-description">
            {isSignUp
              ? "Create an account to make your next visit your own."
              : "Sign in to continue exploring the collection."}
          </p>
          <AuthForm mode={mode} returnTo={pendingOrder ? "/?assistantResume=quote" : returnTo} pendingAdd={pendingAdd} pendingOrder={pendingOrder} />
        </div>

        <footer className="auth-footer">
          <span>Thoughtful pieces, made to find their place.</span>
          <Link href="/">Continue without an account</Link>
        </footer>
      </section>
    </main>
  );
}
