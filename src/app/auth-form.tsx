"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { addBagItemAction, addBagItemsAction } from "@/app/bag/actions";
import type { AssistantBagRequest } from "@/lib/assistant-types";
import { safeReturnPath } from "@/lib/safe-return-path";

export function AuthForm({
  mode,
  returnTo = "/",
  pendingAdd,
  pendingOrder,
}: {
  mode: "sign-in" | "sign-up";
  returnTo?: string;
  pendingAdd?: { productSlug: string; quantity: number };
  pendingOrder?: AssistantBagRequest[];
}) {
  const isSignUp = mode === "sign-up";
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: String(formData.get("name") ?? "").trim(),
            email,
            password,
            callbackURL: safeReturnPath(returnTo),
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL: safeReturnPath(returnTo),
          });

      if (result.error) {
        setError(result.error.message || "We couldn't complete that request. Please try again.");
        return;
      }

      let destination = safeReturnPath(returnTo);
      if (pendingOrder) {
        const addResult = await addBagItemsAction(pendingOrder);
        destination = addResult.ok
          ? "/checkout?assistantOrder=ready"
          : `/checkout?assistantOrderError=${addResult.code === "OUT_OF_STOCK" ? "stock" : "unavailable"}`;
      } else if (pendingAdd) {
        const addResult = await addBagItemAction(pendingAdd.productSlug, pendingAdd.quantity);
        const returnUrl = new URL(destination, window.location.origin);
        returnUrl.searchParams.set("bagNotice", addResult.ok ? "added" : addResult.code === "OUT_OF_STOCK" ? "stock-changed" : "unavailable");
        destination = `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setError("We couldn't connect just now. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        {isSignUp && (
          <label className="auth-field">
            <span>Name</span>
            <input
              autoComplete="name"
              name="name"
              placeholder="Your name"
              required
              maxLength={100}
            />
          </label>
        )}

        <label className="auth-field">
          <span>Email address</span>
          <input
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            type="email"
            required
            maxLength={254}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            name="password"
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            type="password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button className="button auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="auth-switch">
        {isSignUp ? "Already have an account?" : "New to Aurel?"}{" "}
        <Link href={`${isSignUp ? "/sign-in" : "/sign-up"}?${new URLSearchParams({ returnTo: safeReturnPath(returnTo), ...(pendingAdd ? { addProduct: pendingAdd.productSlug, addQuantity: String(pendingAdd.quantity) } : {}), ...(pendingOrder ? { pendingOrder: JSON.stringify(pendingOrder) } : {}) }).toString()}`}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </>
  );
}
