import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createPatient, findByCpfAny, normalizeCpf, clinicalKey } from "@/lib/patients-store";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  let body: { name?: unknown; cpf?: unknown; password?: unknown; email?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const cpf = String(body.cpf || "");
  const password = String(body.password || "").trim();
  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  const phone = body.phone ? String(body.phone) : null;

  if (!name) return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  if (normalizeCpf(cpf).length < 11) {
    return NextResponse.json({ error: "Informe um CPF válido (11 dígitos)." }, { status: 400 });
  }
  if (password && password.length < 4) {
    return NextResponse.json({ error: "A senha deve ter ao menos 4 caracteres." }, { status: 400 });
  }

  // Evita cadastro duplicado: se o CPF já existe (ex.: criado pelo médico), oriente a entrar.
  const existing = await findByCpfAny(cpf);
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um cadastro com este CPF. Use a opção Entrar (senha inicial 123456, se criada pelo seu médico)." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password || "123456", 10);
  const patient = await createPatient({
    doctorId: "", // conta criada pelo próprio paciente (sem médico vinculado ainda)
    name,
    cpf,
    email,
    phone,
    passwordHash,
  });

  // Login automático após criar a conta.
  const res = NextResponse.json({ ok: true, name: patient.name });
  res.cookies.set(PATIENT_COOKIE, createPatientToken(clinicalKey(patient)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
