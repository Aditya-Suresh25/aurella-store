"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { categories, productReviews, products } from "@/db/schema";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

function text(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
function integer(form: FormData, name: string, min = 0) {
  const value = Number(text(form, name));
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`Enter a valid ${name.replaceAll("_", " ")}.`);
  return value;
}
function required(form: FormData, name: string) {
  const value = text(form, name);
  if (!value) throw new Error(`${name.replaceAll("_", " ")} is required.`);
  return value;
}
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function done(section: string, message: string): never { redirect(`/admin/${section}?notice=${encodeURIComponent(message)}`); }
function refreshCatalog() { revalidatePath("/"); revalidatePath("/new-arrivals"); revalidatePath("/collections/[slug]", "page"); revalidatePath("/products/[slug]", "page"); revalidatePath("/admin"); }

export async function saveCategory(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const name = required(form, "name");
  const values = { name, slug: slugify(text(form, "slug") || name), note: required(form, "note"), imageUrl: required(form, "image_url"), imageAlt: required(form, "image_alt"), sortOrder: integer(form, "sort_order") };
  try {
    if (id) await db.update(categories).set(values).where(eq(categories.id, integer(form, "id", 1)));
    else await db.insert(categories).values(values);
  } catch { done("categories", "Could not save category. Check that its slug is unique and values are valid."); }
  refreshCatalog(); done("categories", "Category saved.");
}

export async function setCategoryActive(form: FormData) {
  await requireAdmin();
  await db.update(categories).set({ isActive: text(form, "active") === "true" }).where(eq(categories.id, integer(form, "id", 1)));
  refreshCatalog(); done("categories", "Category status updated.");
}

export async function deleteCategory(form: FormData) {
  await requireAdmin();
  try { await db.delete(categories).where(eq(categories.id, integer(form, "id", 1))); }
  catch { done("categories", "This category is still referenced by products and cannot be deleted. Archive it instead."); }
  refreshCatalog(); done("categories", "Category deleted.");
}

export async function saveProduct(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const price = Number(text(form, "price"));
  if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) > 2147483647) throw new Error("Enter a valid nonnegative price.");
  const name = required(form, "name");
  const badge = text(form, "badge");
  const values = {
    name, slug: slugify(text(form, "slug") || name), categoryId: integer(form, "category_id", 1),
    description: required(form, "description"), descriptor: required(form, "descriptor"),
    priceCents: Math.round(price * 100), currency: required(form, "currency").toUpperCase(),
    badge: badge || null, imageUrl: required(form, "image_url"), imageAlt: required(form, "image_alt"),
    detailImageUrl: required(form, "detail_image_url"), detailImageAlt: required(form, "detail_image_alt"),
    note: required(form, "note"), stockQuantity: integer(form, "stock_quantity"), sortOrder: integer(form, "sort_order"),
  };
  try {
    if (id) await db.update(products).set(values).where(eq(products.id, integer(form, "id", 1)));
    else await db.insert(products).values(values);
  } catch { done("products", "Could not save product. Check its unique slug, category, and field values."); }
  refreshCatalog(); done("products", "Product saved.");
}

export async function setProductActive(form: FormData) {
  await requireAdmin();
  await db.update(products).set({ isActive: text(form, "active") === "true" }).where(eq(products.id, integer(form, "id", 1)));
  refreshCatalog(); done("products", "Product status updated.");
}

export async function updateInventory(form: FormData) {
  await requireAdmin();
  await db.update(products).set({ stockQuantity: integer(form, "stock_quantity") }).where(eq(products.id, integer(form, "id", 1)));
  revalidatePath("/products/[slug]", "page"); revalidatePath("/admin");
  done("products", "Inventory updated.");
}

export async function deleteProduct(form: FormData) {
  await requireAdmin();
  try { await db.delete(products).where(eq(products.id, integer(form, "id", 1))); }
  catch { done("products", "This product is referenced by a bag or order and cannot be deleted. Archive it instead."); }
  refreshCatalog(); done("products", "Product deleted.");
}

export async function moderateProductReview(form: FormData) {
  await requireAdmin();
  const id = integer(form, "review_id", 1);
  const nextStatus = text(form, "status");
  if (nextStatus !== "approved" && nextStatus !== "hidden") done("reviews", "Choose a valid review action.");
  const [review] = await db.select({ productSlug: products.slug }).from(productReviews)
    .innerJoin(products, eq(productReviews.productId, products.id)).where(eq(productReviews.id, id)).limit(1);
  if (!review) done("reviews", "Review could not be found.");
  await db.update(productReviews).set({ status: nextStatus, updatedAt: new Date() }).where(eq(productReviews.id, id));
  revalidatePath(`/products/${review.productSlug}`);
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  done("reviews", nextStatus === "approved" ? "Review approved." : "Review hidden.");
}
