import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PERIOD_COOKIE, isPresetKey } from "@/lib/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/period { period } | { period: "custom", from, to }
export async function POST(req: Request) {
  let body: { period?: string; from?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }

  let value: string;
  if (body.period === "custom") {
    if (!body.from || !body.to || !DATE_RE.test(body.from) || !DATE_RE.test(body.to)) {
      return NextResponse.json({ message: "Datas inválidas (YYYY-MM-DD)." }, { status: 400 });
    }
    // garante from <= to
    const [f, t] = body.from <= body.to ? [body.from, body.to] : [body.to, body.from];
    value = `custom:${f}:${t}`;
  } else if (isPresetKey(body.period)) {
    value = body.period;
  } else {
    return NextResponse.json({ message: "Período inválido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(PERIOD_COOKIE, value, { path: "/", sameSite: "lax", maxAge: 31536000 });
  return NextResponse.json({ ok: true });
}
