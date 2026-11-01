import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { assistantKnowledge, categories, productReviews, products } from "@/db/schema";
import { db } from "@/lib/db";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

function embeddingClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenAI({ apiKey });
}

function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function consumeEmbeddingBudget() {
  const seconds = 86_400;
  const width = seconds * 1000;
  const index = Math.floor(Date.now() / width);
  const start = new Date(index * width);
  const expires = new Date((index + 1) * width);
  const key = `global:daily-model-calls:${index}`;
  const result = await db.execute(sql`INSERT INTO ai_rate_limits (bucket_key, window_start, request_count, expires_at)
    VALUES (${key}, ${start}, 1, ${expires})
    ON CONFLICT (bucket_key) DO UPDATE SET request_count = ai_rate_limits.request_count + 1
    WHERE ai_rate_limits.request_count < 500
    RETURNING bucket_key`);
  if (!result.rows.length) throw new Error("Aurel’s assistant has reached today’s usage limit. Please try again tomorrow.");
}

async function embed(content: string) {
  await consumeEmbeddingBudget();
  const result = await embeddingClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: content.slice(0, 8000),
    config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT", httpOptions: { timeout: 8_000, retryOptions: { attempts: 1 } } },
  });
  const values = result.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error("The assistant could not create a valid retrieval embedding.");
  }
  return values;
}

async function upsertKnowledge(sourceKey: string, sourceType: "product" | "review", productId: number, content: string) {
  const digest = contentHash(content);
  const [existing] = await db.select({ contentHash: assistantKnowledge.contentHash })
    .from(assistantKnowledge).where(eq(assistantKnowledge.sourceKey, sourceKey)).limit(1);
  if (existing?.contentHash === digest) return;
  const embedding = await embed(content);
  await db.insert(assistantKnowledge).values({ sourceKey, sourceType, productId, sourceText: content, contentHash: digest, embedding, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: assistantKnowledge.sourceKey,
      set: { sourceType, productId, sourceText: content, contentHash: digest, embedding, updatedAt: new Date() },
    });
}

export async function indexProductKnowledge(productId: number) {
  const [row] = await db.select({
    id: products.id,
    name: products.name,
    description: products.description,
    descriptor: products.descriptor,
    note: products.note,
    category: categories.name,
    categorySlug: categories.slug,
  }).from(products).innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, productId)).limit(1);
  if (!row) {
    await db.delete(assistantKnowledge).where(and(eq(assistantKnowledge.productId, productId), eq(assistantKnowledge.sourceType, "product")));
    return;
  }
  const content = [row.name, row.category, row.categorySlug, row.descriptor, row.description, row.note].join(". ");
  await upsertKnowledge(`product:${row.id}`, "product", row.id, content);
}

export async function indexApprovedReviewKnowledge(reviewId: number) {
  const [row] = await db.select({
    id: productReviews.id,
    productId: productReviews.productId,
    productName: products.name,
    title: productReviews.title,
    comment: productReviews.comment,
    status: productReviews.status,
  }).from(productReviews).innerJoin(products, eq(productReviews.productId, products.id))
    .where(eq(productReviews.id, reviewId)).limit(1);
  if (!row || row.status !== "approved") {
    await db.delete(assistantKnowledge).where(eq(assistantKnowledge.sourceKey, `review:${reviewId}`));
    return;
  }
  await upsertKnowledge(`review:${row.id}`, "review", row.productId, `${row.productName}. Approved customer review: ${row.title}. ${row.comment}`);
}

export async function removeProductKnowledge(productId: number) {
  await db.delete(assistantKnowledge).where(and(eq(assistantKnowledge.productId, productId), eq(assistantKnowledge.sourceType, "product")));
}

export async function indexAllAssistantKnowledge() {
  const productRows = await db.select({ id: products.id }).from(products).innerJoin(categories, eq(products.categoryId, categories.id));
  for (const row of productRows) await indexProductKnowledge(row.id);
  const reviewRows = await db.select({ id: productReviews.id }).from(productReviews).where(eq(productReviews.status, "approved"));
  for (const row of reviewRows) await indexApprovedReviewKnowledge(row.id);
  await db.execute(sql`DELETE FROM assistant_knowledge WHERE source_type = 'review' AND source_key NOT IN (
    SELECT 'review:' || id::text FROM product_reviews WHERE status = 'approved'
  )`);
  return { products: productRows.length, approvedReviews: reviewRows.length };
}

export async function retrieveAssistantKnowledge(query: string, limit = 24) {
  const startedAt = Date.now();
  await consumeEmbeddingBudget();
  const result = await embeddingClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query.slice(0, 2000),
    config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_QUERY", httpOptions: { timeout: 8_000, retryOptions: { attempts: 1 } } },
  });
  const vector = result.embeddings?.[0]?.values;
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) return [];
  const literal = `[${vector.join(",")}]`;
  const matches = await db.execute<{ product_id: number; source_type: string; source_text: string; distance: number }>(sql`
    SELECT k.product_id, k.source_type, k.source_text,
      k.embedding <=> ${literal}::vector AS distance
    FROM assistant_knowledge k
    JOIN products p ON p.id = k.product_id AND p.is_active = true
    JOIN categories c ON c.id = p.category_id AND c.is_active = true
    WHERE (k.source_type = 'product' OR (k.source_type = 'review' AND EXISTS (
      SELECT 1 FROM product_reviews r
      WHERE k.source_key = 'review:' || r.id::text AND r.product_id = k.product_id AND r.status = 'approved'
    )))
    ORDER BY k.embedding <=> ${literal}::vector
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `);
  console.info(JSON.stringify({ event: "aurel_ai_timing", feature: "chat", stage: "semantic_retrieval", durationMs: Date.now() - startedAt, resultCount: matches.rows.length }));
  return matches.rows.map((row) => ({ productId: Number(row.product_id), sourceType: row.source_type, sourceText: row.source_text, distance: Number(row.distance) }));
}
