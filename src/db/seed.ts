import { config } from "dotenv";
import { categories, products } from "./schema";

config({ path: ".env.local" });
config();

const categorySeeds = [
  {
    slug: "clothing",
    name: "Clothing",
    note: "Easy pieces, considered details",
    imageUrl:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Two friends exploring a city in relaxed seasonal clothing",
    sortOrder: 1,
  },
  {
    slug: "bags",
    name: "Bags",
    note: "Made to move with you",
    imageUrl:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A woven straw bag carried with a floral summer dress",
    sortOrder: 2,
  },
  {
    slug: "objects",
    name: "Objects",
    note: "The little things, made well",
    imageUrl:
      "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A collection of understated everyday accessories",
    sortOrder: 3,
  },
];

const productSeeds = [
  {
    slug: "cotton-poplin-shirt",
    name: "Cotton poplin shirt",
    categorySlug: "clothing",
    description:
      "An easy, considered layer in crisp cotton poplin. Cut with a relaxed shape that works tucked in, worn open, or simply as it is.",
    descriptor: "Lightweight cotton · No. 01",
    priceCents: 19000,
    badge: "New arrival",
    imageUrl:
      "https://images.unsplash.com/photo-1577392975613-e946709754f7?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "A crisp white shirt styled with dark trousers",
    detailImageUrl:
      "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=85",
    detailImageAlt: "Softly structured wardrobe layers in natural colors",
    note: "Lightweight cotton · No. 01",
    stockQuantity: 12,
    sortOrder: 1,
  },
  {
    slug: "riviera-day-dress",
    name: "Riviera day dress",
    categorySlug: "clothing",
    description:
      "A softly shaped summer dress made for long afternoons and unhurried plans. Light, breathable cotton keeps the feeling simple.",
    descriptor: "Summer poplin · No. 04",
    priceCents: 26000,
    badge: "Bestseller",
    imageUrl:
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "A simple white summer dress worn on a sunlit staircase",
    detailImageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85",
    detailImageAlt: "A curated rail of timeless, neutral wardrobe pieces",
    note: "Summer poplin · No. 04",
    stockQuantity: 12,
    sortOrder: 2,
  },
  {
    slug: "weekend-knit-set",
    name: "Weekend knit set",
    categorySlug: "clothing",
    description:
      "A relaxed matching set with an easy drape and a soft hand feel. Wear each piece together or let them find their own way into the week.",
    descriptor: "Soft cotton fleece · No. 08",
    priceCents: 32000,
    badge: "New arrival",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "A model in a bright, relaxed matching cotton set",
    detailImageUrl:
      "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1200&q=85",
    detailImageAlt: "Softly structured wardrobe layers in natural colors",
    note: "Soft cotton fleece · No. 08",
    stockQuantity: 3,
    sortOrder: 3,
  },
  {
    slug: "woven-market-bag",
    name: "Woven market bag",
    categorySlug: "bags",
    description:
      "A handwoven carryall for the everyday things and the extras you pick up along the way. Each piece has a naturally varied texture.",
    descriptor: "Handwoven straw · No. 02",
    priceCents: 16000,
    badge: "Small batch",
    imageUrl:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "A woven straw bag carried with a floral summer dress",
    detailImageUrl:
      "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1200&q=85",
    detailImageAlt: "A collection of understated everyday accessories",
    note: "Handwoven straw · No. 02",
    stockQuantity: 12,
    sortOrder: 4,
  },
];

async function seed() {
  const { db } = await import("../lib/db");

  await db.insert(categories).values(categorySeeds).onConflictDoNothing();

  const existingCategories = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const categoryIds = new Map(existingCategories.map((category) => [category.slug, category.id]));

  const productsToInsert = productSeeds.map(({ categorySlug, ...product }) => {
    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) throw new Error(`Missing category seed: ${categorySlug}`);
    return { ...product, categoryId };
  });

  await db.insert(products).values(productsToInsert).onConflictDoNothing();
  console.info(`Seeded ${categorySeeds.length} categories and ${productsToInsert.length} products (existing slugs left unchanged).`);
}

seed().catch((error: unknown) => {
  console.error("Database seed failed:", error);
  process.exitCode = 1;
});
