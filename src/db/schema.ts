import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const saleStatusEnum = pgEnum("sale_status", [
  "pending", // venda pendente (aguardando pagamento)
  "approved", // venda aprovada
  "refused", // recusada
  "refunded", // reembolsada
  "chargeback",
]);

// Valores internos. Mapeados 1:1 do padrão Utmify no boundary da API:
// credit_card->card, pix->pix, boleto->boleto, paypal->paypal, free_price->free
export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "pix",
  "boleto",
  "paypal",
  "free",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "active",
  "paused",
]);

// ---------- Core hierarchy ----------
// user -> dashboard -> ad_account -> campaign -> ad_insight
//                   \-> sale (ingerida via webhook, casada por UTM)

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"), // null = conta ainda sem senha (pode ser reivindicada)
  plan: text("plan").notNull().default("free"), // free | premium | advanced | monster
  isAdmin: boolean("is_admin").notNull().default(false), // admin = recursos ilimitados
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dashboards = pgTable("dashboards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("BRL"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  countInterest: boolean("count_interest").notNull().default(true), // "Contabilizar juros"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Conexão com um perfil Meta (token de longa duração). 1 perfil -> N contas.
// TODO(segurança): criptografar accessToken em repouso antes de produção.
export const metaConnections = pgTable(
  "meta_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    metaUserId: text("meta_user_id"),
    name: text("name"), // nome do perfil Meta
    accessToken: text("access_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meta_connections_dashboard_idx").on(t.dashboardId)],
);

export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    metaConnectionId: uuid("meta_connection_id").references(() => metaConnections.id, {
      onDelete: "cascade",
    }),
    metaAccountId: text("meta_account_id").notNull(), // act_XXXXXXX
    name: text("name").notNull(),
    currency: text("currency").notNull().default("BRL"),
    accountStatus: text("account_status"), // ACTIVE, DISABLED... (Meta)
    active: boolean("active").notNull().default(true), // usuário liga/desliga
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ad_accounts_dashboard_idx").on(t.dashboardId),
    uniqueIndex("ad_accounts_dash_meta_uq").on(t.dashboardId, t.metaAccountId),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adAccountId: uuid("ad_account_id")
      .notNull()
      .references(() => adAccounts.id, { onDelete: "cascade" }),
    metaCampaignId: text("meta_campaign_id").notNull(), // casa com utm_campaign |id
    name: text("name").notNull(),
    status: campaignStatusEnum("status").notNull().default("active"),
    budgetCents: integer("budget_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaigns_ad_account_idx").on(t.adAccountId),
    index("campaigns_meta_id_idx").on(t.metaCampaignId),
    uniqueIndex("campaigns_account_meta_uq").on(t.adAccountId, t.metaCampaignId),
  ],
);

// Métricas diárias puxadas da Meta Marketing API (spend/impressões/cliques...)
export const adInsights = pgTable(
  "ad_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    spendCents: integer("spend_cents").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    initiateCheckouts: integer("initiate_checkouts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ad_insights_campaign_date_idx").on(t.campaignId, t.date)],
);

// Conjuntos (adsets) sincronizados da Meta SÓ no clique do botão "Sincronizar".
// Orçamento/bid ficam na moeda da CONTA (menor unidade); convertidos p/ BRL na leitura.
// spend/impressões etc. são um SNAPSHOT do período sincronizado (não diário).
export const adSets = pgTable(
  "ad_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    metaAdSetId: text("meta_ad_set_id").notNull(), // casa com utm_medium |id
    name: text("name").notNull(),
    status: campaignStatusEnum("status").notNull().default("active"),
    effectiveStatus: text("effective_status"),
    dailyBudgetCents: integer("daily_budget_cents").notNull().default(0), // moeda da conta
    lifetimeBudgetCents: integer("lifetime_budget_cents").notNull().default(0),
    bidCents: integer("bid_cents"), // moeda da conta
    // snapshot do período sincronizado (moeda da conta p/ spend)
    spendCents: integer("spend_cents").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    initiateCheckouts: integer("initiate_checkouts").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ad_sets_campaign_idx").on(t.campaignId),
    index("ad_sets_meta_id_idx").on(t.metaAdSetId),
    uniqueIndex("ad_sets_campaign_meta_uq").on(t.campaignId, t.metaAdSetId),
  ],
);

// Anúncios (ads) sincronizados da Meta no clique do botão. Sem orçamento próprio.
export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adSetId: uuid("ad_set_id")
      .notNull()
      .references(() => adSets.id, { onDelete: "cascade" }),
    metaAdId: text("meta_ad_id").notNull(), // casa com utm_content |id
    name: text("name").notNull(),
    status: campaignStatusEnum("status").notNull().default("active"),
    effectiveStatus: text("effective_status"),
    spendCents: integer("spend_cents").notNull().default(0), // moeda da conta (snapshot)
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    initiateCheckouts: integer("initiate_checkouts").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ads_ad_set_idx").on(t.adSetId),
    index("ads_meta_id_idx").on(t.metaAdId),
    uniqueIndex("ads_adset_meta_uq").on(t.adSetId, t.metaAdId),
  ],
);

// Vendas ingeridas via webhook do checkout/gateway, casadas por UTM.
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(), // orderId do gateway (idempotência)
    platform: text("platform"), // ex: Kirvano, Kiwify, Hotmart...
    productName: text("product_name").notNull(),
    valueCents: integer("value_cents").notNull(), // commission.totalPriceInCents
    status: saleStatusEnum("status").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    // --- Comissão / financeiro (Utmify commission{}) ---
    gatewayFeeCents: integer("gateway_fee_cents").notNull().default(0),
    userCommissionCents: integer("user_commission_cents").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    // --- Cliente (Utmify customer{}) ---
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerDocument: text("customer_document"),
    customerCountry: text("customer_country"),
    customerIp: text("customer_ip"),
    // --- Tracking (Utmify trackingParameters{}) ---
    src: text("src"),
    sck: text("sck"),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    utmMedium: text("utm_medium"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"), // placement
    metaCampaignId: text("meta_campaign_id"), // parseado de utm_campaign (name|id)
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (t) => [
    index("sales_dashboard_idx").on(t.dashboardId),
    index("sales_created_idx").on(t.createdAt),
    index("sales_meta_campaign_idx").on(t.metaCampaignId),
    // idempotência: uma venda por (dashboard, orderId)
    uniqueIndex("sales_dashboard_order_uq").on(t.dashboardId, t.externalId),
  ],
);

// Credenciais de API (token estilo ke9Lx...). x-api-token -> dashboard.
export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    name: text("name").notNull().default("Credencial"),
    revoked: boolean("revoked").notNull().default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_credentials_token_idx").on(t.token)],
);

// Pixel de otimização: agrupa vários "pixels da Meta" e define quais eventos enviar.
export const pixels = pgTable(
  "pixels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    productName: text("product_name"), // filtra por produto (opcional)
    active: boolean("active").notNull().default(true),
    // Quais eventos reenviar server-side (CAPI)
    sendPurchase: boolean("send_purchase").notNull().default(true),
    sendInitiateCheckout: boolean("send_initiate_checkout").notNull().default(false),
    sendAddToCart: boolean("send_add_to_cart").notNull().default(false),
    sendLead: boolean("send_lead").notNull().default(false),
    sendIp: boolean("send_ip").notNull().default(true), // enviar IP do cliente
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pixels_dashboard_idx").on(t.dashboardId)],
);

// Cada pixel da Meta dentro de um Pixel: id + token (validados) + apelido.
export const metaPixels = pgTable(
  "meta_pixels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pixelId: uuid("pixel_id")
      .notNull()
      .references(() => pixels.id, { onDelete: "cascade" }),
    metaPixelId: text("meta_pixel_id").notNull(), // ex: 1674027533228782
    accessToken: text("access_token").notNull(), // token de CAPI
    label: text("label"), // apelido opcional (ex: "vizao-777")
    validated: boolean("validated").notNull().default(false),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("meta_pixels_pixel_meta_uq").on(t.pixelId, t.metaPixelId)],
);

export type Sale = typeof sales.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Dashboard = typeof dashboards.$inferSelect;
export type Pixel = typeof pixels.$inferSelect;
export type MetaPixel = typeof metaPixels.$inferSelect;
export type AdAccount = typeof adAccounts.$inferSelect;
export type MetaConnection = typeof metaConnections.$inferSelect;
export type ApiCredential = typeof apiCredentials.$inferSelect;
export type AdSet = typeof adSets.$inferSelect;
export type Ad = typeof ads.$inferSelect;

// Config de notificações (push PWA) por dashboard. 1 linha por dashboard.
export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" })
      .unique(),
    sendPending: boolean("send_pending").notNull().default(false),
    sendApproved: boolean("send_approved").notNull().default(true),
    showValue: boolean("show_value").notNull().default(true),
    showProduct: boolean("show_product").notNull().default(true),
    showUtmCampaign: boolean("show_utm_campaign").notNull().default(false),
    showDashboardName: boolean("show_dashboard_name").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_settings_dashboard_idx").on(t.dashboardId)],
);

// Assinaturas de Web Push (PWA). Uma por navegador/dispositivo.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_dashboard_idx").on(t.dashboardId)],
);

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// Log de execução de cada sync (manual ou agendado) — observabilidade.
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id").references(() => dashboards.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull().default("manual"), // manual | scheduled
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    campaignsUpserted: integer("campaigns_upserted").notNull().default(0),
    adsetsUpserted: integer("adsets_upserted").notNull().default(0),
    adsUpserted: integer("ads_upserted").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    usagePct: integer("usage_pct").notNull().default(0), // maior % de uso da Meta observado
    note: text("note"),
  },
  (t) => [index("sync_runs_dashboard_idx").on(t.dashboardId), index("sync_runs_started_idx").on(t.startedAt)],
);

export type SyncRun = typeof syncRuns.$inferSelect;

// ---------- Regras de Otimização ----------
// Uma regra age sobre campanhas/conjuntos/anúncios de uma plataforma quando
// TODAS as suas condições batem. Por enquanto só plataforma "meta".
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("meta"), // meta | google | kwai ...
    name: text("name").notNull(),
    adAccountId: uuid("ad_account_id").references(() => adAccounts.id, { onDelete: "cascade" }), // null = todas as contas
    // A quem aplicar: ActiveCampaigns|ActiveAdsets|ActiveAds|PausedCampaigns|PausedAdsets|PausedAds
    applyTo: text("apply_to").notNull().default("ActiveCampaigns"),
    // Ação: activate|pause|increase_budget|decrease_budget|set_budget
    action: text("action").notNull(),
    amount: doublePrecision("amount").notNull().default(0), // % (se amountIsPercent) OU R$ (fixo/alvo)
    amountIsPercent: boolean("amount_is_percent").notNull().default(false),
    maxBudgetCents: integer("max_budget_cents").notNull().default(0), // 0 = sem limite
    conditionLevel: text("condition_level").notNull().default("object"),
    frequencyMinutes: integer("frequency_minutes").notNull().default(60),
    calcPeriod: text("calc_period").notNull().default("today"),
    execWindowStart: text("exec_window_start"), // "HH:MM" ou null = qualquer
    execWindowEnd: text("exec_window_end"),
    dailyLimit: integer("daily_limit").notNull().default(0), // 0 = sem limite
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rules_dashboard_idx").on(t.dashboardId), index("rules_platform_idx").on(t.platform)],
);

// Condições da regra (AND entre todas). field=métrica, operator=gt|lt|gte|lte, value=limiar.
export const ruleConditions = pgTable(
  "rule_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    field: text("field").notNull(), // spend|cpa|roi|roas|profit|profitMargin|cpc|budget|cpi|approvedSales|initiatedCheckouts|ctr|cpm|clicks|conversations|costPerConversation|costPerLead|cpv|pv
    operator: text("operator").notNull(), // gt|lt|gte|lte
    value: doublePrecision("value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rule_conditions_rule_idx").on(t.ruleId)],
);

// Log de execução das regras (auditoria: quantos casaram/foram alterados).
export const ruleExecutions = pgTable(
  "rule_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    matchedCount: integer("matched_count").notNull().default(0),
    actedCount: integer("acted_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    note: text("note"),
  },
  (t) => [index("rule_executions_rule_idx").on(t.ruleId)],
);

export type Rule = typeof rules.$inferSelect;
export type RuleCondition = typeof ruleConditions.$inferSelect;
export type RuleExecution = typeof ruleExecutions.$inferSelect;
