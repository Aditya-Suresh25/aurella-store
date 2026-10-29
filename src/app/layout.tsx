import type { Metadata } from "next";
import { CartProvider } from "@/app/cart-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurel — Well made things for the everyday",
  description: "Thoughtful clothing, bags, and objects made for everyday life.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
