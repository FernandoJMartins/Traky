import { createHmac, timingSafeEqual } from "crypto";

// State assinado pro OAuth. Stateless (sem cookie) → funciona quando o retorno
// acontece em OUTRO navegador (fluxo multilogin / anti-detect).

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-troque-em-producao";
const TTL_MS = 10 * 60 * 1000; // 10 min

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signState(dashboardId: string): string {
  const payload = b64url(JSON.stringify({ d: dashboardId, exp: Date.now() + TTL_MS }));
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(token: string | null): { dashboardId: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  // comparação em tempo constante
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { d, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof d !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return { dashboardId: d };
  } catch {
    return null;
  }
}
