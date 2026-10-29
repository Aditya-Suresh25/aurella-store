"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useCurrentAccount } from "@/app/cart-store";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "A";
}

export function AccountControl({ className = "" }: { className?: string }) {
  const router = useRouter();
  const account = useCurrentAccount();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  if (!account) {
    return (
      <Link className={`header-account nav-link ${className}`} href="/sign-in">
        Sign in
      </Link>
    );
  }

  const name = account.name?.trim() || "Account";

  async function signOut() {
    setIsSigningOut(true);
    setSignOutError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError("We could not sign you out. Please try again.");
        setIsSigningOut(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("We could not sign you out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <details className={`account-control ${className}`}>
      <summary className="account-trigger" aria-label={`Account menu for ${name}`}>
        <span className="account-avatar" aria-hidden="true">{getInitials(name)}</span>
        <span className="account-name">{name}</span>
        <span className="account-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="account-popover">
        <p className="account-popover-name">{name}</p>
        <p className="account-email">{account.email}</p>
        {account.role === "admin" && <Link className="account-orders-link" href="/admin">Admin panel</Link>}
        <Link className="account-orders-link" href="/orders">Your orders</Link>
        {signOutError && <p className="account-error" role="alert">{signOutError}</p>}
        <button className="account-logout" type="button" onClick={signOut} disabled={isSigningOut}>
          {isSigningOut ? "Signing out…" : "Log out"}
        </button>
      </div>
    </details>
  );
}
