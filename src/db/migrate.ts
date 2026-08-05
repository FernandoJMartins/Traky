import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

// Códigos Postgres de "objeto já existe" — tolerados (migração aplicada fora do runner).
const DUPLICATE_CODES = new Set([
  "42P07", // duplicate_table / relation (tabela, índice)
  "42701", // duplicate_column
  "42710", // duplicate_object (constraint, type/enum)
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  "42P04", // duplicate_database
  "42P16", // invalid_table_definition (constraint duplicada em alguns casos)
]);

/**
 * Aplica as migrações pendentes de `drizzle/*.sql` no boot do app.
 * - Registra o que já rodou em `_migrations` (por nome de arquivo).
 * - Tolera erros de "já existe" → auto-baseline em bancos já migrados na mão.
 * - Banco novo (produção): cria tudo do zero, em ordem.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[migrate] DATABASE_URL ausente — pulando migrações.");
    return;
  }

  const dir = join(process.cwd(), "drizzle");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.warn("[migrate] pasta drizzle/ não encontrada — pulando migrações.");
    return;
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS "_migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )`;
    const applied = new Set((await sql<{ name: string }[]>`SELECT name FROM "_migrations"`).map((r) => r.name));

    let total = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const raw = readFileSync(join(dir, file), "utf8");
      const statements = raw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);

      let ran = 0;
      let skipped = 0;
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt);
          ran++;
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code && DUPLICATE_CODES.has(code)) {
            skipped++;
            continue; // já existe → segue (baseline)
          }
          console.error(`[migrate] falha em ${file}:`, (e as Error).message);
          throw e;
        }
      }
      await sql`INSERT INTO "_migrations" (name) VALUES (${file})`;
      total++;
      console.log(`[migrate] ${file}: ${ran} aplicada(s)${skipped ? `, ${skipped} já existia(m)` : ""}`);
    }
    console.log(total === 0 ? "[migrate] banco já em dia." : `[migrate] ${total} migração(ões) processada(s).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Permite rodar manualmente: `npm run db:migrate`
// (o Next carrega o .env sozinho no boot; no CLI avulso a gente carrega aqui).
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  import("dotenv/config")
    .catch(() => {})
    .then(() => runMigrations())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
