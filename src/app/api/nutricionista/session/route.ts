import { NextResponse } from "next/server";
import { NUTRITIONIST_COOKIE, NUTRITIONIST_MAX_AGE, createNutritionistToken } from "@/lib/nutrition-session";
import { findNutritionistByCpfOrEmail, touchNutritionistAccess, verifyNutritionistPassword } from "@/lib/nutritionists-store";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const identifier = String(b.identifier || b.cpf || b.email || "").trim();
    const password = String(b.password || "");
    if (!identifier || !password) return NextResponse.json({ error: "Informe CPF ou e-mail e a senha." }, { status: 400 });

    const nut = await findNutritionistByCpfOrEmail(identifier, identifier);
    if (!nut || !(await verifyNutritionistPassword(nut, password))) {
      return NextResponse.json({ error: "CPF/e-mail ou senha inválidos." }, { status: 401 });
    }
    if (nut.status !== "active") {
      const msg = nut.status === "pending"
        ? "Seu cadastro está em análise pelo administrador. Você receberá acesso após a aprovação."
        : nut.status === "rejected"
          ? "Seu cadastro não foi aprovado. Entre em contato com o administrador."
          : nut.status === "suspended"
            ? "Seu acesso está suspenso. Entre em contato com o administrador."
            : "Sua conta está inativa.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    await touchNutritionistAccess(nut.id);

    const res = NextResponse.json({ ok: true, name: nut.name });
    res.cookies.set(NUTRITIONIST_COOKIE, createNutritionistToken(nut.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: NUTRITIONIST_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("nutricionista/session", err);
    return NextResponse.json({ error: "Não foi possível entrar agora." }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NUTRITIONIST_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
