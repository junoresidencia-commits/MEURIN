import { NextResponse } from "next/server";
import { ALLIED_COOKIE, ALLIED_MAX_AGE, createAlliedToken } from "@/lib/allied-session";
import { ALLIED_ROLES, findAlliedForLogin, touchAlliedAccess, verifyAlliedPassword, type AlliedRole } from "@/lib/allied-store";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const role = b.role as AlliedRole;
    if (!ALLIED_ROLES.includes(role)) return NextResponse.json({ error: "Informe a especialidade." }, { status: 400 });
    const identifier = String(b.identifier || b.cpf || b.email || "").trim();
    const password = String(b.password || "");
    if (!identifier || !password) return NextResponse.json({ error: "Informe CPF ou e-mail e a senha." }, { status: 400 });
    const pro = await findAlliedForLogin(role, identifier);
    if (!pro || !(await verifyAlliedPassword(pro, password))) {
      return NextResponse.json({ error: "CPF/e-mail ou senha inválidos." }, { status: 401 });
    }
    if (pro.status !== "active") {
      const msg = pro.status === "pending"
        ? "Seu cadastro está em análise. Aguarde o nefrologista ou o administrador liberar o acesso."
        : "Sua conta não está ativa.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    await touchAlliedAccess(pro.id);
    const res = NextResponse.json({ ok: true, name: pro.name, role: pro.role });
    res.cookies.set(ALLIED_COOKIE, createAlliedToken(pro.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ALLIED_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("allied/session", err);
    return NextResponse.json({ error: "Não foi possível entrar agora." }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ALLIED_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
