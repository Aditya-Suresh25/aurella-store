import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "@/db/auth-schema";

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
