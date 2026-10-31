import type { Metadata } from "next";
import { headers } from "next/headers";
import { CartProvider } from "@/app/cart-store";
import { ShoppingAssistant } from "@/app/shopping-assistant";
import { auth } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurel — Well made things for the everyday",
  description: "Thoughtful clothing, bags, and objects made for everyday life.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <html lang="en">
      <body><CartProvider initialSession={session}>{children}<ShoppingAssistant /></CartProvider></body>
    </html>
  );
}
