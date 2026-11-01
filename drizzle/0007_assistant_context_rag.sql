CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "assistant_action_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"source_type" text NOT NULL,
	"product_id" integer NOT NULL,
	"source_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_knowledge_source_key_unique" UNIQUE("source_key"),
	CONSTRAINT "assistant_knowledge_source_type_valid" CHECK ("assistant_knowledge"."source_type" in ('product', 'review'))
);
--> statement-breakpoint
CREATE TABLE "assistant_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_action_keys" ADD CONSTRAINT "assistant_action_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_knowledge" ADD CONSTRAINT "assistant_knowledge_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_action_keys_created_at_idx" ON "assistant_action_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assistant_knowledge_product_id_idx" ON "assistant_knowledge" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "assistant_knowledge_source_type_idx" ON "assistant_knowledge" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "assistant_sessions_expires_at_idx" ON "assistant_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "assistant_knowledge_embedding_hnsw_idx" ON "assistant_knowledge" USING hnsw ("embedding" vector_cosine_ops);
