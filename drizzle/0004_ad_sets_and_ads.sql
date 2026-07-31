CREATE TABLE "ad_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"meta_ad_set_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"effective_status" text,
	"daily_budget_cents" integer DEFAULT 0 NOT NULL,
	"lifetime_budget_cents" integer DEFAULT 0 NOT NULL,
	"bid_cents" integer,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"initiate_checkouts" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_set_id" uuid NOT NULL,
	"meta_ad_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"effective_status" text,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"initiate_checkouts" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_set_id_ad_sets_id_fk" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_sets_campaign_idx" ON "ad_sets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ad_sets_meta_id_idx" ON "ad_sets" USING btree ("meta_ad_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_sets_campaign_meta_uq" ON "ad_sets" USING btree ("campaign_id","meta_ad_set_id");--> statement-breakpoint
CREATE INDEX "ads_ad_set_idx" ON "ads" USING btree ("ad_set_id");--> statement-breakpoint
CREATE INDEX "ads_meta_id_idx" ON "ads" USING btree ("meta_ad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ads_adset_meta_uq" ON "ads" USING btree ("ad_set_id","meta_ad_id");
