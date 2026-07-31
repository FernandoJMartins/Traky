import { NextResponse } from "next/server";
import { exchangeCodeForToken, getLongLivedToken, MetaApiError } from "@/lib/meta";
import { verifyState } from "@/lib/oauth-state";
import { connectManualToken, syncConnection } from "@/lib/meta-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monta a base de redirect correta. Atrás do ngrok, req.url vira
// https://localhost:3000 (host local + proto https) e quebra o SSL.
// Preferimos APP_URL; senão, o host público encaminhado; e forçamos http no localhost.
function redirectBase(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  let proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (/localhost|127\.0\.0\.1/.test(host)) proto = "http";
  return `${proto}://${host}`;
}

// GET /api/integrations/meta/oauth/callback?code=...&state=...
export async function GET(req: Request) {
  const base = redirectBase(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(new URL(`/integracoes?error=${encodeURIComponent(error)}`, base));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/integracoes?error=sem_code", base));
  }

  // valida o state assinado (funciona mesmo em outro navegador — multilogin)
  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/integracoes?error=state_invalido_ou_expirado", base));
  }

  try {
    const short = await exchangeCodeForToken(code);
    const long = await getLongLivedToken(short.access_token).catch(() => short);

    const { connection } = await connectManualToken(verified.dashboardId, long.access_token);
    await syncConnection(connection.id).catch(() => null);

    return NextResponse.redirect(new URL("/integracoes?connected=1", base));
  } catch (e) {
    const msg = e instanceof MetaApiError ? e.message : e instanceof Error ? e.message : "erro";
    return NextResponse.redirect(new URL(`/integracoes?error=${encodeURIComponent(msg)}`, base));
  }
}
