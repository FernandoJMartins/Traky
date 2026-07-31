CREATE TABLE "meta_pixels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pixel_id" uuid NOT NULL,
	"meta_pixel_id" text NOT NULL,
	"access_token" text NOT NULL,
	"label" text,
	"validated" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pixels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"name" text NOT NULL,
	"product_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"send_purchase" boolean DEFAULT true NOT NULL,
	"send_initiate_checkout" boolean DEFAULT false NOT NULL,
	"send_add_to_cart" boolean DEFAULT false NOT NULL,
	"send_lead" boolean DEFAULT false NOT NULL,
	"send_ip" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_pixels" ADD CONSTRAINT "meta_pixels_pixel_id_pixels_id_fk" FOREIGN KEY ("pixel_id") REFERENCES "public"."pixels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meta_pixels_pixel_meta_uq" ON "meta_pixels" USING btree ("pixel_id","meta_pixel_id");--> statement-breakpoint
CREATE INDEX "pixels_dashboard_idx" ON "pixels" USING btree ("dashboard_id");