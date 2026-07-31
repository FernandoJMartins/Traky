import { db } from "@/db";
import { apiCredentials } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type ResolvedCredential = {
  credentialId: string;
  dashboardId: string;
};

/** Resolve um token de API (x-api-token / x-api-key / Bearer) para um dashboard. */
export async function resolveToken(token: string | null): Promise<ResolvedCredential | null> {
  if (!token) return null;
  const [cred] = await db
    .select()
    .from(apiCredentials)
    .where(and(eq(apiCredentials.token, token), eq(apiCredentials.revoked, false)))
    .limit(1);
  if (!cred) return null;

  // marca uso (fire-and-forget, não bloqueia a request)
  db.update(apiCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiCredentials.id, cred.id))
    .catch(() => {});

  return { credentialId: cred.id, dashboardId: cred.dashboardId };
}

/** Extrai o token dos headers, aceitando os 3 formatos que a Utmify aceita. */
export function extractToken(headers: Headers): string | null {
  const xToken = headers.get("x-api-token");
  if (xToken) return xToken.trim();
  const xKey = headers.get("x-api-key");
  if (xKey) return xKey.trim();
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}
