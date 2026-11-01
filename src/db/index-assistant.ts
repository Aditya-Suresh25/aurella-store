import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { indexAllAssistantKnowledge } = await import("../lib/assistant-retrieval");
  const counts = await indexAllAssistantKnowledge();
  console.info(`Aurel assistant retrieval index is up to date: ${counts.products} products, ${counts.approvedReviews} approved reviews.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Assistant indexing failed.");
  process.exitCode = 1;
});
