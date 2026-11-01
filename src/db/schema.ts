import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "@/db/auth-schema";

const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(768)",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) => String(value).slice(1, -1).split(",").map(Number),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  note: text("note").notNull(),
  imageUrl: text("image_url").notNull(),
  imageAlt: text("image_alt").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    descriptor: text("descriptor").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    badge: text("badge"),
    imageUrl: text("image_url").notNull(),
    imageAlt: text("image_alt").notNull(),
    detailImageUrl: text("detail_image_url").notNull(),
    detailImageAlt: text("detail_image_alt").notNull(),
    note: text("note").notNull(),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    check("products_price_nonnegative", sql`${table.priceCents} >= 0`),
    check("products_stock_nonnegative", sql`${table.stockQuantity} >= 0`),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("carts_user_id_unique").on(table.userId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
    unique("cart_items_cart_product_unique").on(table.cartId, table.productId),
    index("cart_items_cart_id_idx").on(table.cartId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending"),
    inventoryIssue: boolean("inventory_issue").notNull().default(false),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    subtotalCents: integer("subtotal_cents").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("orders_user_id_idx").on(table.userId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    productSlug: text("product_slug").notNull(),
    imageUrl: text("image_url").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    currency: text("currency").notNull(),
  },
  (table) => [
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    index("order_items_order_id_idx").on(table.orderId),
  ],
);

export const productReviews = pgTable(
  "product_reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    title: text("title").notNull(),
    comment: text("comment").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("product_reviews_rating_range", sql`${table.rating} between 1 and 5`),
    check("product_reviews_status_valid", sql`${table.status} in ('pending', 'approved', 'hidden')`),
    check("product_reviews_title_length", sql`char_length(trim(${table.title})) between 3 and 120`),
    check("product_reviews_comment_length", sql`char_length(trim(${table.comment})) between 10 and 3000`),
    unique("product_reviews_user_product_unique").on(table.userId, table.productId),
    index("product_reviews_product_status_created_idx").on(table.productId, table.status, table.createdAt),
    index("product_reviews_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const reviewImages = pgTable(
  "review_images",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id").notNull().references(() => productReviews.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    publicId: text("public_id").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check("review_images_sort_order_range", sql`${table.sortOrder} between 0 and 2`),
    index("review_images_review_id_idx").on(table.reviewId),
  ],
);

export const aiRateLimits = pgTable(
  "ai_rate_limits",
  {
    bucketKey: text("bucket_key").primaryKey(),
    windowStart: timestamp("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("ai_rate_limits_expires_at_idx").on(table.expiresAt)],
);

export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    cacheKey: text("cache_key").notNull(),
    sourceHash: text("source_hash").notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("ai_summaries_kind_cache_key_unique").on(table.kind, table.cacheKey),
    index("ai_summaries_updated_at_idx").on(table.updatedAt),
  ],
);

export const assistantSessions = pgTable(
  "assistant_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    state: jsonb("state").notNull().default({}),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [index("assistant_sessions_expires_at_idx").on(table.expiresAt)],
);

export const assistantActionKeys = pgTable(
  "assistant_action_keys",
  {
    key: text("key").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("assistant_action_keys_created_at_idx").on(table.createdAt)],
);

export const assistantKnowledge = pgTable(
  "assistant_knowledge",
  {
    id: serial("id").primaryKey(),
    sourceKey: text("source_key").notNull().unique(),
    sourceType: text("source_type").notNull(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sourceText: text("source_text").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector768("embedding").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check("assistant_knowledge_source_type_valid", sql`${table.sourceType} in ('product', 'review')`),
    index("assistant_knowledge_product_id_idx").on(table.productId),
    index("assistant_knowledge_source_type_idx").on(table.sourceType),
  ],
);
