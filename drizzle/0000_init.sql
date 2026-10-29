CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"unit_price_pence" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" between 1 and 3),
	CONSTRAINT "order_items_price_check" CHECK ("order_items"."unit_price_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"reference" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"subtotal_pence" integer NOT NULL,
	"delivery_pence" integer NOT NULL,
	"total_pence" integer NOT NULL,
	"stripe_session_id" text,
	"reserved_until" timestamp with time zone NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "orders_reference_unique" UNIQUE("reference"),
	CONSTRAINT "orders_stripe_session_id_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending', 'paid', 'expired', 'cancelled')),
	CONSTRAINT "orders_livemode_check" CHECK ("orders"."livemode" = false),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total_pence" = "orders"."subtotal_pence" + "orders"."delivery_pence" and "orders"."subtotal_pence" >= 0 and "orders"."delivery_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"size" text NOT NULL,
	"price_pence" integer NOT NULL,
	"roast" text,
	"caffeine" text,
	"origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"flavour_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"brew_methods" text[] DEFAULT '{}'::text[] NOT NULL,
	"stock" integer NOT NULL,
	"seed_stock" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"art" text NOT NULL,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_category_check" CHECK ("products"."category" in ('beans', 'gear', 'bundle')),
	CONSTRAINT "products_roast_check" CHECK ("products"."roast" is null or "products"."roast" in ('light', 'medium', 'medium-dark', 'dark')),
	CONSTRAINT "products_caffeine_check" CHECK ("products"."caffeine" is null or "products"."caffeine" in ('regular', 'decaf')),
	CONSTRAINT "products_brew_methods_check" CHECK ("products"."brew_methods" <@ array['espresso', 'pour-over', 'batch-brew', 'cafetiere', 'hand-press', 'moka-pot', 'cold-brew']::text[]),
	CONSTRAINT "products_price_check" CHECK ("products"."price_pence" between 1 and 100000),
	CONSTRAINT "products_stock_check" CHECK ("products"."stock" >= 0 and "products"."seed_stock" >= 0),
	CONSTRAINT "products_text_length_check" CHECK (length("products"."name") <= 80 and length("products"."description") <= 600 and length("products"."slug") <= 80)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "search_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result_count" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"layer" text NOT NULL,
	"cost_micropence" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_reserved_idx" ON "orders" USING btree ("status","reserved_until");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "search_events_created_at_idx" ON "search_events" USING btree ("created_at");