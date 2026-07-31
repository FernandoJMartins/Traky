CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"platform" text DEFAULT 'meta' NOT NULL,
	"name" text NOT NULL,
	"ad_account_id" uuid,
	"apply_to" text DEFAULT 'ActiveCampaigns' NOT NULL,
	"action" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"amount_is_percent" boolean DEFAULT false NOT NULL,
	"max_budget_cents" integer DEFAULT 0 NOT NULL,
	"condition_level" text DEFAULT 'object' NOT NULL,
	"frequency_minutes" integer DEFAULT 60 NOT NULL,
	"calc_period" text DEFAULT 'today' NOT NULL,
	"exec_window_start" text,
	"exec_window_end" text,
	"daily_limit" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"field" text NOT NULL,
	"operator" text NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"acted_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_conditions" ADD CONSTRAINT "rule_conditions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rules_dashboard_idx" ON "rules" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX "rules_platform_idx" ON "rules" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "rule_conditions_rule_idx" ON "rule_conditions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_executions_rule_idx" ON "rule_executions" USING btree ("rule_id");
