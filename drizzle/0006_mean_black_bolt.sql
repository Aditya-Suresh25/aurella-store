CREATE TABLE "ai_rate_limits" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"cache_key" text NOT NULL,
	"source_hash" text NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_summaries_kind_cache_key_unique" UNIQUE("kind","cache_key")
);
--> statement-breakpoint
CREATE INDEX "ai_rate_limits_expires_at_idx" ON "ai_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_summaries_updated_at_idx" ON "ai_summaries" USING btree ("updated_at");