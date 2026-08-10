import { NextResponse } from "next/server";
import { ATTENDANT_COOKIE, ATTENDANT_MAX_AGE, createAttendantToken } from "@/lib/attendant-session";
import { findAttendantByCpfOrEmail, listLinksForAttendant, touchAttendantAccess, verifyAttendantPassword } from "@/lib/attendants-store";

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const identifier = String(b.identifier || b.cpf || b.email || "").trim();
    const password = String(b.password || "");
    if (!identifier || !password) return NextResponse.json({ error: "Informe CPF ou e-mail e a senha." }, { status: 400 });

    // O identificador pode ser CPF OU e-mail — tentamos os dois.
    const att = await findAttendantByCpfOrEmail(identifier, identifier);
    if (!att || att.status !== "active" || !(await verifyAttendantPassword(att, password))) {
      return NextResponse.json({ error: "CPF/e-mail ou senha inválidos." }, { status: 401 });
    }
    const links = await listLinksForAttendant(att.id);
    if (links.length === 0) {
      return NextResponse.json({ error: "Sua conta não está vinculada a nenhum médico. Peça para o médico adicionar você à equipe." }, { status: 403 });
    }
    await touchAttendantAccess(att.id);

    const res = NextResponse.json({ ok: true, name: att.name });
    res.cookies.set(ATTENDANT_COOKIE, createAttendantToken(att.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ATTENDANT_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("atendente/session", err);
    return NextResponse.json({ error: "Não foi possível entrar agora." }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ATTENDANT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
