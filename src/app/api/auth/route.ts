import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { COOKIE, DOCTOR_MAX_AGE, createSessionToken, getDoctorSessionId } from "@/lib/auth";
import { getDoctorById, listDoctors } from "@/lib/store";
import { emailsMatch } from "@/lib/login-email";
import { buildPlatformActor } from "@/lib/platform-access";
import { ensureFounderSuperAdmin, listActiveRoles } from "@/lib/platform-store";

async function platformRolesSafe(doctorId: string): Promise<string[]> {
  try {
    await ensureFounderSuperAdmin();
    return await listActiveRoles("doctor", doctorId);
  } catch (err) {
    console.error("[auth] papéis da plataforma ignorados", err);
    return [];
  }
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ doctor: null });
  }
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ doctor: null });
  const { passwordHash, mpAccessToken, ...safe } = doctor;
  void passwordHash;
  let actor = null;
  try {
    actor = await buildPlatformActor(doctor);
  } catch (err) {
    console.error("[auth] ator da plataforma ignorado", err);
  }
  const platformRoles = actor?.roles ?? [];
  return NextResponse.json({
    doctor: {
      ...safe,
      mpConnected: Boolean(mpAccessToken?.trim()),
      platformRoles,
      clinicAdmin: actor?.clinicAdmin ?? [],
    },
  });
}

export async function POST(req: Request) {
  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body?.email || "");
    password = String(body?.password || "");
  } catch {
    return NextResponse.json({ error: "Dados de login inválidos." }, { status: 400 });
  }
  let doctors;
  try {
    doctors = await listDoctors();
  } catch (err) {
    console.error("[auth] falha ao ler médicos", err);
    return NextResponse.json({ error: "Não foi possível entrar. Tente novamente." }, { status: 503 });
  }
  const doctor = doctors.find((d) => emailsMatch(d.email, email));
  const pass = password.trim();
  let passwordOk = false;
  try {
    passwordOk = Boolean(doctor?.passwordHash && pass && (await bcrypt.compare(pass, doctor.passwordHash)));
  } catch (err) {
    console.error("[auth] falha ao conferir senha", err);
    passwordOk = false;
  }
  if (!doctor || !passwordOk) {
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
  const platformRoles = await platformRolesSafe(doctor.id);
  const res = NextResponse.json({
    ok: true,
    doctor: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      platformRoles,
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

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
