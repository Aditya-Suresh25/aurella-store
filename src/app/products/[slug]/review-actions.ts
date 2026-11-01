"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/bag-service";
import { getCloudinary } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { indexApprovedReviewKnowledge } from "@/lib/assistant-retrieval";
import { getCustomerReview, getVerifiedOrder } from "@/lib/review-service";
import { products } from "@/db/schema";

export type ReviewFormState = { error?: string; success?: string };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 3;

class ReviewValidationError extends Error {}

function isJpeg(bytes: Buffer) { return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; }
function isPng(bytes: Buffer) { return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])); }

export async function saveProductReviewAction(_previous: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Sign in to submit a review." };
  const slug = String(form.get("productSlug") ?? "");
  const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(sql`${products.slug} = ${slug} and ${products.isActive} = true`).limit(1);
  if (!product) return { error: "This product is no longer available for review." };
  const purchase = await getVerifiedOrder(userId, product.id);
  if (!purchase) return { error: "A paid order containing this product is required to review it." };

  const rating = Number(form.get("rating"));
  const title = String(form.get("title") ?? "").trim();
  const comment = String(form.get("comment") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from one to five stars." };
  if (title.length < 3 || title.length > 120) return { error: "The title must be between 3 and 120 characters." };
  if (comment.length < 10 || comment.length > 3000) return { error: "The comment must be between 10 and 3,000 characters." };

  const existing = await getCustomerReview(userId, product.id);
  const keepIds = form.getAll("keepImage").map(String);
  if (new Set(keepIds).size !== keepIds.length || keepIds.some((id) => !existing?.images.some((image) => image.publicId === id))) {
    return { error: "One of the selected existing photos is invalid. Refresh the page and try again." };
  }
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (keepIds.length + photos.length > MAX_PHOTOS) return { error: "A review can include up to three photos." };

  let cloud: ReturnType<typeof getCloudinary> | null = null;
  if (photos.length || existing?.images.some((image) => !keepIds.includes(image.publicId))) {
    try { cloud = getCloudinary(); }
    catch { return { error: "Review photo uploads are not configured yet. Please contact the store." }; }
  }
  const uploaded: { url: string; publicId: string; sortOrder: number }[] = [];
  try {
    for (const [index, photo] of photos.entries()) {
      if (photo.size > MAX_PHOTO_BYTES) throw new ReviewValidationError("Each photo must be 5 MB or smaller.");
      if (photo.type !== "image/jpeg" && photo.type !== "image/png") throw new ReviewValidationError("Upload JPEG or PNG photos only.");
      const bytes = Buffer.from(await photo.arrayBuffer());
      const valid = photo.type === "image/jpeg" ? isJpeg(bytes) : isPng(bytes);
      if (!valid) throw new ReviewValidationError("A selected photo is not a valid JPEG or PNG image.");
      const dataUri = `data:${photo.type};base64,${bytes.toString("base64")}`;
      if (!cloud) throw new Error("Review photo uploads are not configured yet.");
      const result = await cloud.uploader.upload(dataUri, {
        folder: `aurel/reviews/${product.id}/${userId}`,
        allowed_formats: ["jpg", "jpeg", "png"],
        resource_type: "image",
        transformation: [{ width: 1800, height: 1800, crop: "limit" }],
        tags: ["aurel-review", `product-${product.id}`],
      });
      uploaded.push({ url: result.secure_url, publicId: result.public_id, sortOrder: keepIds.length + index });
    }
    const uploadedForSql = uploaded.map(({ url, publicId, sortOrder }) => ({
      url,
      public_id: publicId,
      sort_order: sortOrder,
    }));

    const persisted = await db.execute<{ id: number; removed_public_ids: string[] | null }>(sql`
      with verified_order as (
        select o.id
        from orders o
        inner join order_items oi on oi.order_id = o.id and oi.product_id = ${product.id}
        where o.id = ${purchase.orderId} and o.user_id = ${userId} and o.status = 'paid'
        limit 1
      ), saved_review as (
        insert into product_reviews (user_id, product_id, order_id, rating, title, comment, status)
        select ${userId}, ${product.id}, verified_order.id, ${rating}, ${title}, ${comment}, 'pending'
        from verified_order
        on conflict (user_id, product_id) do update set
          order_id = excluded.order_id,
          rating = excluded.rating,
          title = excluded.title,
          comment = excluded.comment,
          status = 'pending',
          updated_at = now()
        returning id
      ), removed_images as (
        delete from review_images ri
        using saved_review sr
        where ri.review_id = sr.id and not exists (
          select 1 from jsonb_array_elements_text(${JSON.stringify(keepIds)}::jsonb) as kept(public_id)
          where kept.public_id = ri.public_id
        )
        returning ri.public_id
      ), retained_images as (
        update review_images ri set sort_order = incoming.sort_order
        from saved_review sr
        cross join jsonb_to_recordset(${JSON.stringify(keepIds.map((publicId, sortOrder) => ({ public_id: publicId, sort_order: sortOrder })))}::jsonb)
          as incoming(public_id text, sort_order integer)
        where ri.review_id = sr.id and ri.public_id = incoming.public_id
        returning ri.id
      ), inserted_images as (
        insert into review_images (review_id, url, public_id, sort_order)
        select sr.id, incoming.url, incoming.public_id, incoming.sort_order
        from saved_review sr
        cross join (select count(*) from retained_images) retained
        cross join jsonb_to_recordset(${JSON.stringify(uploadedForSql)}::jsonb)
          as incoming(url text, public_id text, sort_order integer)
        returning id
      )
      select sr.id, coalesce((select array_agg(public_id) from removed_images), array[]::text[]) as removed_public_ids
      from saved_review sr
    `);
    const row = persisted.rows[0];
    if (!row) throw new ReviewValidationError("The paid purchase could not be verified. Please refresh and try again.");
    const oldIds = row.removed_public_ids ?? [];
    if (oldIds.length && cloud) await Promise.allSettled(oldIds.map((publicId) => cloud.uploader.destroy(publicId, { resource_type: "image" })));
    try { await indexApprovedReviewKnowledge(row.id); }
    catch { try { await db.execute(sql`delete from assistant_knowledge where source_key = ${`review:${row.id}`}`); } catch { /* Review retrieval is refreshed when the database migration is applied. */ } }
    revalidatePath(`/products/${slug}`);
    revalidatePath("/admin/reviews");
    return { success: existing ? "Your changes are saved and waiting for approval." : "Your review is submitted and waiting for approval." };
  } catch (error) {
    if (cloud) await Promise.allSettled(uploaded.map((image) => cloud.uploader.destroy(image.publicId, { resource_type: "image" })));
    return { error: error instanceof ReviewValidationError ? error.message : "Your review could not be saved. Please try again." };
  }
}
