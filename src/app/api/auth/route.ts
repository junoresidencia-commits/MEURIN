import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { COOKIE, DOCTOR_MAX_AGE, createSessionToken, getDoctorSessionId } from "@/lib/auth";
import { ALLIED_COOKIE, ALLIED_MAX_AGE, createAlliedToken } from "@/lib/allied-session";
import { findAlliedDoctorByCpfOrEmail, touchAlliedAccess, verifyAlliedPassword } from "@/lib/allied-store";
import { readDb } from "@/lib/store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ doctor: null });
  }
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor) return NextResponse.json({ doctor: null });
  const { passwordHash, mpAccessToken, ...safe } = doctor;
  void passwordHash;
  // Nunca devolvemos o token do Mercado Pago ao navegador — só se está conectado.
  return NextResponse.json({ doctor: { ...safe, mpConnected: Boolean(mpAccessToken?.trim()) } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const identifier = String(body.email || body.identifier || body.cpf || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "Informe e-mail ou CPF e a senha." }, { status: 400 });
  }

  const db = await readDb();
  const idLower = identifier.toLowerCase();
  const cpf = identifier.replace(/\D/g, "");
  const doctor = db.doctors.find((d) => {
    if (d.email.toLowerCase() === idLower) return true;
    if (cpf.length === 11 && String(d.cpf || "").replace(/\D/g, "") === cpf) return true;
    return false;
  });

  if (doctor) {
    if (!(await bcrypt.compare(password, doctor.passwordHash))) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }
    const status = doctor.status ?? "approved";
    if (status !== "approved") {
      const messages: Record<string, string> = {
        pending: "Seu cadastro está aguardando aprovação do administrador do Meu Rim.",
        correction: "Seu cadastro precisa de correção. Verifique o aviso enviado pelo administrador.",
        rejected: "Seu cadastro não foi aprovado. Fale com o administrador do Meu Rim.",
        suspended: "Seu acesso está suspenso. Fale com o administrador do Meu Rim.",
      };
      return NextResponse.json(
        { error: messages[status] || "Acesso indisponível no momento." },
        { status: 403 }
      );
    }
    const token = createSessionToken(doctor.id);
    const res = NextResponse.json({
      ok: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
      },
    });
    res.cookies.set(COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DOCTOR_MAX_AGE,
    });
    return res;
  }

  const pro = await findAlliedDoctorByCpfOrEmail(identifier, identifier);
  if (!pro || !(await verifyAlliedPassword(pro, password))) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
  if (pro.status !== "active") {
    const msg = pro.status === "pending"
      ? "Seu cadastro está em análise. Aguarde o nefrologista ou o administrador liberar o acesso."
      : "Sua conta não está ativa.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
  await touchAlliedAccess(pro.id);
  const res = NextResponse.json({ ok: true, kind: "allied", name: pro.name, role: pro.role });
  res.cookies.set(ALLIED_COOKIE, createAlliedToken(pro.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ALLIED_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(ALLIED_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
