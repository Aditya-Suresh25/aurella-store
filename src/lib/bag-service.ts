import "server-only";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartItems, carts, categories, products } from "@/db/schema";
import type { BagActionResult, BagData } from "@/lib/bag-types";

const emptyBag: BagData = { items: [], itemCount: 0, subtotalCents: 0, currency: "USD" };

export async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

async function getCartId(userId: string, create: boolean) {
  const [existing] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  if (existing) return existing.id;
  if (!create) return null;

  await db.insert(carts).values({ userId }).onConflictDoNothing({ target: carts.userId });
  const [created] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  return created?.id ?? null;
}

export async function getBagForUser(userId: string): Promise<BagData> {
  const cartId = await getCartId(userId, false);
  if (!cartId) return emptyBag;

  const items = await db
    .select({
      id: cartItems.id,
      productSlug: products.slug,
      name: products.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
      priceCents: products.priceCents,
      currency: products.currency,
      imageUrl: products.imageUrl,
      imageAlt: products.imageAlt,
      quantity: cartItems.quantity,
      stockQuantity: products.stockQuantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);

  return {
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalCents: items.reduce((total, item) => total + item.priceCents * item.quantity, 0),
    currency: items[0]?.currency ?? "USD",
  };
}

export async function getCurrentBag(): Promise<BagActionResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to view your bag." };
  return { ok: true, data: await getBagForUser(userId) };
}

export async function addBagItemForUser(userId: string, productSlug: string, quantity: number): Promise<BagActionResult> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, code: "INVALID_QUANTITY", error: "Choose a valid quantity." };
  }

  const [product] = await db
    .select({ id: products.id, stockQuantity: products.stockQuantity })
    .from(products)
    .where(eq(products.slug, productSlug))
    .limit(1);

  if (!product) return { ok: false, code: "NOT_FOUND", error: "This product is no longer available." };
  if (product.stockQuantity < quantity) {
    return { ok: false, code: "OUT_OF_STOCK", error: "There is not enough stock for that quantity." };
  }

  const cartId = await getCartId(userId, true);
  if (!cartId) return { ok: false, error: "Your bag could not be created. Please try again." };

  const result = await db.execute<{ id: number }>(sql`
    insert into cart_items (cart_id, product_id, quantity)
    select ${cartId}, p.id, ${quantity}
    from products p
    where p.id = ${product.id} and p.stock_quantity >= ${quantity}
    on conflict (cart_id, product_id) do update
      set quantity = cart_items.quantity + excluded.quantity,
          updated_at = now()
      where cart_items.quantity + excluded.quantity <= (
        select stock_quantity from products where id = excluded.product_id
      )
    returning id
  `);

  if (!result.rows.length) {
    return { ok: false, code: "OUT_OF_STOCK", error: "There is not enough stock for that quantity." };
  }
  return { ok: true, data: await getBagForUser(userId) };
}

export async function setBagItemQuantityForUser(
  userId: string,
  productSlug: string,
  quantity: number,
): Promise<BagActionResult> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, code: "INVALID_QUANTITY", error: "Choose a quantity of at least one." };
  }

  const cartId = await getCartId(userId, false);
  if (!cartId) return { ok: false, code: "NOT_FOUND", error: "This item is no longer in your bag." };

  const result = await db.execute<{ id: number }>(sql`
    update cart_items ci
    set quantity = ${quantity}, updated_at = now()
    from products p
    where ci.cart_id = ${cartId}
      and ci.product_id = p.id
      and p.slug = ${productSlug}
      and p.stock_quantity >= ${quantity}
    returning ci.id
  `);

  if (!result.rows.length) {
    const [product] = await db
      .select({ stockQuantity: products.stockQuantity })
      .from(products)
      .where(eq(products.slug, productSlug))
      .limit(1);
    if (!product) return { ok: false, code: "NOT_FOUND", error: "This product is no longer available." };
    if (product.stockQuantity < quantity) {
      return { ok: false, code: "OUT_OF_STOCK", error: "The requested quantity is above current stock." };
    }
    return { ok: false, code: "NOT_FOUND", error: "This item is no longer in your bag." };
  }
  return { ok: true, data: await getBagForUser(userId) };
}

export async function removeBagItemForUser(userId: string, productSlug: string): Promise<BagActionResult> {
  const cartId = await getCartId(userId, false);
  if (!cartId) return { ok: true, data: emptyBag };
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, productSlug)).limit(1);
  if (product) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, product.id)));
  }
  return { ok: true, data: await getBagForUser(userId) };
}
