"use server";

import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { orderItems, orders, products } from "@/db/schema";
import { db } from "@/lib/db";
import { getBagForUser, getCurrentUserId } from "@/lib/bag-service";
import { getStripe } from "@/lib/stripe";

export async function startCheckoutAction() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in?returnTo=%2Fcheckout");

  const bag = await getBagForUser(userId);
  if (bag.items.length === 0) redirect("/bag?checkout=empty");
  if (bag.items.some((item) => item.stockQuantity < item.quantity)) redirect("/bag?checkout=stock");
  if (bag.items.some((item) => item.currency !== bag.currency)) redirect("/bag?checkout=currency");

  const rows = await db
    .select({ id: products.id, slug: products.slug, name: products.name, imageUrl: products.imageUrl, priceCents: products.priceCents, currency: products.currency, stockQuantity: products.stockQuantity })
    .from(products)
    .where(inArray(products.slug, bag.items.map((item) => item.productSlug)));
  const bySlug = new Map(rows.map((product) => [product.slug, product]));
  const lineItems = bag.items.map((item) => {
    const product = bySlug.get(item.productSlug);
    if (!product || product.stockQuantity < item.quantity || product.priceCents !== item.priceCents || product.currency !== item.currency) {
      return null;
    }
    return { item, product };
  });
  if (lineItems.some((entry) => !entry)) redirect("/bag?checkout=updated");
  const validItems = lineItems.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const subtotalCents = validItems.reduce((sum, { item, product }) => sum + product.priceCents * item.quantity, 0);
  const [order] = await db.insert(orders).values({
    userId,
    subtotalCents,
    currency: bag.currency.toLowerCase(),
  }).returning({ id: orders.id });

  await db.insert(orderItems).values(validItems.map(({ item, product }) => ({
    orderId: order.id,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    imageUrl: product.imageUrl,
    unitPriceCents: product.priceCents,
    quantity: item.quantity,
    currency: product.currency.toLowerCase(),
  })));

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const integrationSuffix = Array.from(randomBytes(8), (byte) => String.fromCharCode(97 + (byte % 26))).join("");
  const integrationId = `aurel_checkout_${integrationSuffix}`;
  let session;
  try {
    session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: validItems.map(({ item, product }) => ({
        quantity: item.quantity,
        price_data: {
          currency: product.currency.toLowerCase(),
          unit_amount: product.priceCents,
          product_data: { name: product.name, images: [product.imageUrl] },
        },
      })),
      client_reference_id: String(order.id),
      metadata: { order_id: String(order.id), integration_identifier: integrationId },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?canceled=1`,
    });
  } catch (error) {
    await db.update(orders).set({ status: "failed", updatedAt: new Date() }).where(eq(orders.id, order.id));
    throw error;
  }

  await db.update(orders).set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() }).where(eq(orders.id, order.id));
  if (!session.url) redirect("/checkout?error=session");
  redirect(session.url);
}
