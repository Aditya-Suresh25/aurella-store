import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, products } from "@/db/schema";

export function formatProductPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

export async function getHomepageProducts() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      descriptor: products.descriptor,
      priceCents: products.priceCents,
      currency: products.currency,
      imageUrl: products.imageUrl,
      imageAlt: products.imageAlt,
      badge: products.badge,
    })
    .from(products)
    .orderBy(asc(products.sortOrder));
}

export async function getStorefrontCategories() {
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      note: categories.note,
      imageUrl: categories.imageUrl,
      imageAlt: categories.imageAlt,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder));
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      categoryName: categories.name,
      description: products.description,
      descriptor: products.descriptor,
      priceCents: products.priceCents,
      currency: products.currency,
      badge: products.badge,
      imageUrl: products.imageUrl,
      imageAlt: products.imageAlt,
      detailImageUrl: products.detailImageUrl,
      detailImageAlt: products.detailImageAlt,
      note: products.note,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);

  return product ?? null;
}
