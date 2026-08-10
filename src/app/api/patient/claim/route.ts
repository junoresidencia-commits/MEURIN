import { NextResponse } from "next/server";
import {
  findByCpfAny,
  normalizeCpf,
  clinicalKey,
  updatePatient,
  setPatientPassword,
} from "@/lib/patients-store";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Confirmação segura sem usar CPF como único fator: nome + (telefone ou data de nascimento quando existir). */
function identityMatches(
  patient: { name: string; phone?: string | null; birthdate?: string | null },
  input: { name: string; phone?: string; birthdate?: string }
): { ok: boolean; reason?: string } {
  const expected = normalizeName(patient.name);
  const given = normalizeName(input.name);
  if (!given || given.length < 3) {
    return { ok: false, reason: "Informe o nome completo como no cadastro." };
  }
  const expParts = expected.split(" ");
  const givenParts = given.split(" ");
  const firstOk = expParts[0] === givenParts[0];
  const lastOk =
    expParts.length === 1 ||
    givenParts[givenParts.length - 1] === expParts[expParts.length - 1];
  if (!firstOk || !lastOk) {
    return { ok: false, reason: "O nome não confere com o cadastro encontrado." };
  }

  const hasPhone = Boolean(patient.phone && normalizeCpf(patient.phone).length >= 8);
  const hasBirth = Boolean(patient.birthdate && String(patient.birthdate).length >= 8);

  if (hasPhone) {
    const stored = String(patient.phone).replace(/\D/g, "");
    const provided = String(input.phone || "").replace(/\D/g, "");
    if (provided.length < 4 || !stored.endsWith(provided.slice(-4))) {
      return {
        ok: false,
        reason: "Confirme os 4 últimos dígitos do telefone cadastrado pelo médico.",
      };
    }
  } else if (hasBirth) {
    const stored = String(patient.birthdate).slice(0, 10);
    const provided = String(input.birthdate || "").slice(0, 10);
    if (!provided || provided !== stored) {
      return { ok: false, reason: "Confirme a data de nascimento cadastrada." };
    }
  }

  return { ok: true };
}

/**
 * Vincula a conta do paciente a um prontuário/cadastro já existente pelo CPF,
 * após confirmação de identidade (nome + telefone/nascimento quando houver).
 */
export async function POST(req: Request) {
  let body: {
    cpf?: unknown;
    name?: unknown;
    password?: unknown;
    email?: unknown;
    phone?: unknown;
    birthdate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Não recebemos os dados. Tente novamente." }, { status: 400 });
  }

  const cpfNorm = normalizeCpf(body.cpf as string);
  const name = String(body.name || "").trim();
  const password = String(body.password || "").trim();
  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  const phone = body.phone ? String(body.phone).trim() : undefined;
  const birthdate = body.birthdate ? String(body.birthdate).trim() : undefined;

  if (cpfNorm.length !== 11) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  }
  if (password && password.length < 4) {
    return NextResponse.json({ error: "Escolha uma senha com pelo menos 4 caracteres." }, { status: 400 });
  }

  const patient = await findByCpfAny(cpfNorm);
  if (!patient) {
    return NextResponse.json(
      { error: "Não encontramos cadastro com este CPF. Crie uma conta nova." },
      { status: 404 }
    );
  }

  const check = identityMatches(patient, { name, phone, birthdate });
  if (!check.ok) {
    return NextResponse.json({ error: check.reason || "Não foi possível validar sua identidade." }, { status: 403 });
  }

  if (password) {
    await setPatientPassword(patient.id, password);
  }

  const patched = await updatePatient(patient.id, {
    name: patient.name, // mantém nome clínico do prontuário
    email: email || patient.email,
    phone: phone || patient.phone,
    birthdate: birthdate || patient.birthdate,
  });

  const keyPatient = patched || patient;
  const res = NextResponse.json({
    ok: true,
    linked: true,
    name: keyPatient.name,
    message: "Conta conectada ao cadastro encontrado. Bem-vindo(a) ao Meu Rim.",
  });
  res.cookies.set(PATIENT_COOKIE, createPatientToken(clinicalKey(keyPatient)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
