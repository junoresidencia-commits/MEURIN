import { NextResponse } from "next/server";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";
import { clinicalKey, findByCpfAny, verifyPatientPassword } from "@/lib/patients-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function setSession(subject: string, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: true, ...extra });
  res.cookies.set(PATIENT_COOKIE, createPatientToken(subject), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Login por CPF + senha (paciente criado pelo médico; senha inicial 123456)
  if (body.cpf) {
    const patient = await findByCpfAny(String(body.cpf));
    if (!patient) {
      return NextResponse.json({ error: "CPF não encontrado. Confira ou peça o convite ao seu médico." }, { status: 401 });
    }
    const ok = await verifyPatientPassword(patient, String(body.password || ""));
    if (!ok) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
    return setSession(clinicalKey(patient), { name: patient.name });
  }

  // Login por e-mail (pacientes vindos de agendamento)
  const normalized = String(body.email || "").toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  return setSession(normalized, { email: normalized });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PATIENT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
