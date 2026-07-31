ALTER TYPE "public"."payment_method" ADD VALUE 'paypal';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'free';--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"token" text NOT NULL,
	"name" text DEFAULT 'Credencial' NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_credentials_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "external_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "gateway_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "user_commission_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "currency" text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_document" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_country" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "customer_ip" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "src" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sck" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_credentials_token_idx" ON "api_credentials" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_dashboard_order_uq" ON "sales" USING btree ("dashboard_id","external_id");