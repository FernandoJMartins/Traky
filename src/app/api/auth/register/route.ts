import { NextResponse } from "next/server";
import { db } from "@/db";
import { dashboards, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSessionToken, hashPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register { email, password, name? }
// Cria conta nova (+ dashboard padrão) OU reivindica uma conta existente sem senha.
export async function POST(req: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim() || null;

  if (!EMAIL_RE.test(email)) return NextResponse.json({ message: "E-mail inválido." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ message: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  let userId: string;
  if (existing) {
    if (existing.passwordHash) {
      return NextResponse.json({ message: "E-mail já cadastrado. Faça login." }, { status: 409 });
    }
    // Conta sem senha (ex: dados existentes) — reivindica.
    await db
      .update(users)
      .set({ passwordHash: hashPassword(password), name: name ?? existing.name })
      .where(eq(users.id, existing.id));
    userId = existing.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({ email, name, passwordHash: hashPassword(password) })
      .returning({ id: users.id });
    userId = created.id;
    await db.insert(dashboards).values({ userId, name: name ? `Dashboard de ${name}` : "Meu Dashboard" });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), sessionCookieOptions);
  return res;
}
