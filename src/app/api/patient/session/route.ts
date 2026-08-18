import { NextResponse } from "next/server";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";
import { clinicalKey, findByCpfAny, normalizeCpf, verifyPatientPassword } from "@/lib/patients-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

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

  try {
    // Login por CPF + senha (aceita CPF com ou sem máscara).
    if (body.cpf) {
      const cpfNorm = normalizeCpf(String(body.cpf));
      if (cpfNorm.length !== 11) {
        return NextResponse.json({ error: "CPF inválido. Confira os números digitados." }, { status: 400 });
      }
      const patient = await findByCpfAny(cpfNorm);
      if (!patient) {
        return NextResponse.json({ error: "CPF não encontrado. Confira ou peça o convite ao seu médico." }, { status: 401 });
      }
      const ok = await verifyPatientPassword(patient, String(body.password || ""));
      if (!ok) {
        return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
      }
      return setSession(clinicalKey(patient), { name: patient.name, mustChangePassword: patient.mustChangePassword === true });
    }

    // Login por e-mail (pacientes vindos de agendamento)
    const normalized = String(body.email || "").toLowerCase().trim();
    if (!EMAIL_RE.test(normalized)) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    return setSession(normalized, { email: normalized });
  } catch (error) {
    console.error("Erro ao entrar (paciente):", error);
    return NextResponse.json(
      { error: "Não foi possível entrar agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PATIENT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
