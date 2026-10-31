import "server-only";

import { and, count, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, productReviews, products, reviewImages } from "@/db/schema";
import { user } from "@/db/auth-schema";

export const REVIEWS_PER_PAGE = 10;
export type ReviewSort = "newest" | "highest" | "lowest";

export async function getVerifiedOrder(userId: string, productId: number) {
  const [purchase] = await db.select({ orderId: orders.id }).from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.productId, productId), eq(orders.userId, userId), eq(orders.status, "paid")))
    .orderBy(desc(orders.createdAt)).limit(1);
  return purchase ?? null;
}

export async function getCustomerReview(userId: string, productId: number) {
  const [review] = await db.select().from(productReviews)
    .where(and(eq(productReviews.userId, userId), eq(productReviews.productId, productId))).limit(1);
  if (!review) return null;
  const images = await db.select({ id: reviewImages.id, url: reviewImages.url, publicId: reviewImages.publicId, sortOrder: reviewImages.sortOrder })
    .from(reviewImages).where(eq(reviewImages.reviewId, review.id)).orderBy(reviewImages.sortOrder);
  return { ...review, images };
}

export async function getProductReviewData(productId: number, filters: {
  rating?: number; photosOnly: boolean; verifiedOnly: boolean; sort: ReviewSort; page: number;
}) {
  const conditions = [eq(productReviews.productId, productId), eq(productReviews.status, "approved")];
  if (filters.rating) conditions.push(eq(productReviews.rating, filters.rating));
  if (filters.photosOnly) conditions.push(exists(db.select({ one: sql`1` }).from(reviewImages).where(eq(reviewImages.reviewId, productReviews.id))));
  if (filters.verifiedOnly) conditions.push(exists(db.select({ one: sql`1` }).from(orders).innerJoin(orderItems, and(eq(orderItems.orderId, orders.id), eq(orderItems.productId, productReviews.productId))).where(and(eq(orders.id, productReviews.orderId), eq(orders.userId, productReviews.userId), eq(orders.status, "paid")))));

  const [summaryRows, filteredCountRows] = await Promise.all([
    db.select({ rating: productReviews.rating, total: count() }).from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved"))).groupBy(productReviews.rating),
    db.select({ total: count() }).from(productReviews).where(and(...conditions)),
  ]);
  const histogram = [1, 2, 3, 4, 5].map((rating) => ({ rating, count: Number(summaryRows.find((row) => row.rating === rating)?.total ?? 0) }));
  const totalApproved = histogram.reduce((sum, row) => sum + row.count, 0);
  const average = totalApproved ? histogram.reduce((sum, row) => sum + row.rating * row.count, 0) / totalApproved : 0;
  const filteredCount = Number(filteredCountRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(filteredCount / REVIEWS_PER_PAGE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const orderBy = filters.sort === "highest" ? [desc(productReviews.rating), desc(productReviews.createdAt)]
    : filters.sort === "lowest" ? [sql`${productReviews.rating} asc`, desc(productReviews.createdAt)]
      : [desc(productReviews.createdAt)];
  const rows = await db.select({
    id: productReviews.id, rating: productReviews.rating, title: productReviews.title, comment: productReviews.comment,
    createdAt: productReviews.createdAt, reviewer: user.name,
  }).from(productReviews).innerJoin(user, eq(productReviews.userId, user.id))
    .where(and(...conditions)).orderBy(...orderBy)
    .limit(REVIEWS_PER_PAGE).offset((page - 1) * REVIEWS_PER_PAGE);
  const ids = rows.map((row) => row.id);
  const images = ids.length ? await db.select({ reviewId: reviewImages.reviewId, url: reviewImages.url, id: reviewImages.id })
    .from(reviewImages).where(inArray(reviewImages.reviewId, ids)).orderBy(reviewImages.sortOrder) : [];
  return {
    average, totalApproved, histogram, filteredCount, page, pageCount,
    reviews: rows.map((row) => ({ ...row, reviewer: row.reviewer.trim().split(/\s+/)[0] || "Aurel customer", verified: true, images: images.filter((image) => image.reviewId === row.id) })),
  };
}

export async function getAdminReviews(status: "pending" | "approved" | "hidden", page: number) {
  const pageSize = 25;
  const [totalRows] = await Promise.all([
    db.select({ total: count() }).from(productReviews).where(eq(productReviews.status, status)),
  ]);
  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const rows = await db.select({ id: productReviews.id, productId: products.id, productName: products.name, productSlug: products.slug,
      reviewer: user.name, email: user.email, rating: productReviews.rating, title: productReviews.title,
      comment: productReviews.comment, status: productReviews.status, createdAt: productReviews.createdAt,
    }).from(productReviews).innerJoin(products, eq(productReviews.productId, products.id))
      .innerJoin(user, eq(productReviews.userId, user.id)).where(eq(productReviews.status, status))
      .orderBy(desc(productReviews.createdAt)).limit(pageSize).offset((currentPage - 1) * pageSize);
  const ids = rows.map((row) => row.id);
  const images = ids.length ? await db.select({ reviewId: reviewImages.reviewId, url: reviewImages.url, publicId: reviewImages.publicId })
    .from(reviewImages).where(inArray(reviewImages.reviewId, ids)).orderBy(reviewImages.sortOrder) : [];
  return { total, page: currentPage, pageCount, rows: rows.map((row) => ({ ...row, images: images.filter((image) => image.reviewId === row.id) })) };
}
