ALTER TABLE "campaigns" ADD COLUMN "effective_status" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "issues_info" text;--> statement-breakpoint
ALTER TABLE "ad_sets" ADD COLUMN "issues_info" text;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "issues_info" text;
