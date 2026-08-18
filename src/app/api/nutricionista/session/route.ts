import { NextResponse } from "next/server";
import { NUTRITIONIST_COOKIE, NUTRITIONIST_MAX_AGE, createNutritionistToken } from "@/lib/nutrition-session";
import { findNutritionistByCpfOrEmail, listNutritionLinksForNutritionist, touchNutritionistAccess, verifyNutritionistPassword } from "@/lib/nutritionists-store";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const identifier = String(b.identifier || b.cpf || b.email || "").trim();
    const password = String(b.password || "");
    if (!identifier || !password) return NextResponse.json({ error: "Informe CPF ou e-mail e a senha." }, { status: 400 });

    const nut = await findNutritionistByCpfOrEmail(identifier, identifier);
    if (!nut || nut.status !== "active" || !(await verifyNutritionistPassword(nut, password))) {
      return NextResponse.json({ error: "CPF/e-mail ou senha inválidos." }, { status: 401 });
    }
    const links = await listNutritionLinksForNutritionist(nut.id);
    if (links.length === 0) {
      return NextResponse.json({ error: "Sua conta não está vinculada a nenhum médico. Peça para o médico adicionar você à equipe de nutrição." }, { status: 403 });
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
