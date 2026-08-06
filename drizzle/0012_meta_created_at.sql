-- created_time da Meta por entidade — permite mostrar campanhas/conjuntos/anúncios
-- criados no período selecionado mesmo sem gasto (ex.: anúncios recém-criados/rejeitados).
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "meta_created_at" timestamptz;
ALTER TABLE "ad_sets" ADD COLUMN IF NOT EXISTS "meta_created_at" timestamptz;
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "meta_created_at" timestamptz;
