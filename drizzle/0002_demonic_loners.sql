CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"meta_user_id" text,
	"name" text,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "ad_insights_campaign_date_idx";--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "meta_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "account_status" text;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meta_connections_dashboard_idx" ON "meta_connections" USING btree ("dashboard_id");--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_meta_connection_id_meta_connections_id_fk" FOREIGN KEY ("meta_connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_accounts_dash_meta_uq" ON "ad_accounts" USING btree ("dashboard_id","meta_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_account_meta_uq" ON "campaigns" USING btree ("ad_account_id","meta_campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_insights_campaign_date_idx" ON "ad_insights" USING btree ("campaign_id","date");