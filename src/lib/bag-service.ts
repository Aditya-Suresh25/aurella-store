import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assistantActionKeys, cartItems, carts, categories, products } from "@/db/schema";
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
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, productSlug), eq(products.isActive, true), eq(categories.isActive, true)))
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

export async function addBagItemsForUser(
  userId: string,
  requestedItems: Array<{ productSlug: string; quantity: number }>,
  idempotencyKey?: string,
): Promise<BagActionResult> {
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 6) {
    return { ok: false, code: "INVALID_QUANTITY", error: "Choose between one and six order items." };
  }

  const combined = new Map<string, number>();
  for (const item of requestedItems) {
    if (!item || typeof item.productSlug !== "string" || !/^[a-z0-9-]{1,100}$/.test(item.productSlug) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      return { ok: false, code: "INVALID_QUANTITY", error: "One of the requested quantities is invalid." };
    }
    const total = (combined.get(item.productSlug) ?? 0) + item.quantity;
    if (total > 99) return { ok: false, code: "INVALID_QUANTITY", error: "The quantity for one product cannot exceed 99." };
    combined.set(item.productSlug, total);
  }
  const items = [...combined].map(([productSlug, quantity]) => ({ productSlug, quantity }));
  const slugs = items.map((item) => item.productSlug);
  const serializedItems = JSON.stringify(items);
  const sqlItems = JSON.stringify(items.map(({ productSlug, quantity }) => ({ product_slug: productSlug, quantity })));
  const actionKey = idempotencyKey
    ? createHash("sha256").update(`${userId}:${idempotencyKey}:${serializedItems}`).digest("hex")
    : null;
  if (actionKey) {
    const [priorAction] = await db.select({ key: assistantActionKeys.key }).from(assistantActionKeys)
      .where(and(eq(assistantActionKeys.key, actionKey), eq(assistantActionKeys.userId, userId))).limit(1);
    if (priorAction) return { ok: true, data: await getBagForUser(userId) };
  }
  const availableProducts = await db.select({
    id: products.id,
    slug: products.slug,
    stockQuantity: products.stockQuantity,
    currency: products.currency,
  }).from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(inArray(products.slug, slugs), eq(products.isActive, true), eq(categories.isActive, true)));
  const productBySlug = new Map(availableProducts.map((product) => [product.slug, product]));
  if (items.some((item) => !productBySlug.has(item.productSlug))) {
    return { ok: false, code: "NOT_FOUND", error: "One of those products is no longer available." };
  }

  const bagBefore = await getBagForUser(userId);
  const currencies = new Set([...bagBefore.items.map((item) => item.currency), ...availableProducts.map((product) => product.currency)]);
  if (currencies.size > 1) {
    return { ok: false, code: "CURRENCY_MISMATCH", error: "Your bag contains different currencies. Update your bag before preparing this order." };
  }
  const currentQuantity = new Map(bagBefore.items.map((item) => [item.productSlug, item.quantity]));
  if (items.some((item) => {
    const stock = productBySlug.get(item.productSlug)?.stockQuantity ?? 0;
    return stock < item.quantity + (currentQuantity.get(item.productSlug) ?? 0) || item.quantity + (currentQuantity.get(item.productSlug) ?? 0) > 99;
  })) {
    return { ok: false, code: "OUT_OF_STOCK", error: "There is not enough stock for the full order. Nothing was added." };
  }

  const cartId = await getCartId(userId, true);
  if (!cartId) return { ok: false, error: "Your bag could not be created. Please try again." };

  try {
    await db.execute(sql`
    WITH
    requested AS MATERIALIZED (
      SELECT input.product_slug, input.quantity, p.id AS product_id
      FROM jsonb_to_recordset(${sqlItems}::jsonb) AS input(product_slug text, quantity integer)
      LEFT JOIN products p ON p.slug = input.product_slug
    ),
    locked_products AS MATERIALIZED (
      SELECT p.id, p.stock_quantity, p.is_active, p.category_id
      FROM products p
      JOIN requested r ON r.product_id = p.id
      FOR UPDATE OF p
    ),
    locked_categories AS MATERIALIZED (
      SELECT c.id, c.is_active
      FROM categories c
      WHERE c.id IN (SELECT category_id FROM locked_products)
      FOR SHARE OF c
    ),
    locked_items AS MATERIALIZED (
      SELECT ci.product_id, ci.quantity
      FROM cart_items ci
      JOIN locked_products p ON p.id = ci.product_id
      WHERE ci.cart_id = ${cartId}
      FOR UPDATE OF ci
    ),
    validation AS (
      SELECT count(*) = ${items.length} AND bool_and(
        r.quantity BETWEEN 1 AND 99
        AND p.id IS NOT NULL
        AND p.is_active = true
        AND c.is_active = true
        AND p.stock_quantity >= coalesce(ci.quantity, 0) + r.quantity
        AND coalesce(ci.quantity, 0) + r.quantity <= 99
      ) AS valid
      FROM requested r
      LEFT JOIN locked_products p ON p.id = r.product_id
      LEFT JOIN locked_categories c ON c.id = p.category_id
      LEFT JOIN locked_items ci ON ci.product_id = p.id
    ),
    action_claim AS (
      INSERT INTO assistant_action_keys (key, user_id)
      SELECT ${actionKey ?? ""}, ${userId}
      WHERE ${actionKey !== null} AND coalesce((SELECT valid FROM validation), false)
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    ),
    action_existing AS MATERIALIZED (
      SELECT key FROM assistant_action_keys WHERE key = ${actionKey ?? ""} AND user_id = ${userId}
    ),
    inserted_items AS (
      INSERT INTO cart_items (cart_id, product_id, quantity)
      SELECT ${cartId}, p.id, r.quantity
      FROM requested r
      JOIN locked_products p ON p.id = r.product_id
      CROSS JOIN validation v
      WHERE v.valid AND (${actionKey === null ? sql`true` : sql`EXISTS (SELECT 1 FROM action_claim)`})
      ON CONFLICT (cart_id, product_id) DO UPDATE
        SET quantity = cart_items.quantity + excluded.quantity, updated_at = now()
      WHERE cart_items.quantity + excluded.quantity <= (
        SELECT stock_quantity FROM locked_products WHERE id = excluded.product_id
      )
      RETURNING id
    )
    SELECT CASE WHEN (coalesce((SELECT valid FROM validation), false)
      AND (SELECT count(*) FROM inserted_items) = ${items.length})
      OR (${actionKey === null ? sql`false` : sql`NOT EXISTS (SELECT 1 FROM action_claim) AND EXISTS (SELECT 1 FROM action_existing)`}) THEN true
      ELSE (1 / (SELECT CASE WHEN count(*) = ${items.length} THEN 1 ELSE 0 END FROM inserted_items) = 1) END AS valid
  `);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "22012") {
      return { ok: false, code: "OUT_OF_STOCK", error: "Availability changed while preparing your order. Please review stock and try again." };
    }
    throw error;
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
