import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createPatient, findByCpfAny, normalizeCpf, clinicalKey } from "@/lib/patients-store";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cria a conta do paciente com o mínimo: nome + CPF + senha (opcional → 123456).
 * E-mail e telefone são OPCIONAIS. Nenhum erro técnico é devolvido ao usuário:
 * a mensagem é sempre amigável em português e o detalhe vai para console.error.
 */
export async function POST(req: Request) {
  let body: { name?: unknown; cpf?: unknown; password?: unknown; email?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Não recebemos os dados do formulário. Tente novamente." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const cpfNorm = normalizeCpf(body.cpf as string); // aceita 000.000.000-00 ou 00000000000
  // E-mail/telefone opcionais: string vazia vira null e NÃO impede o cadastro.
  const email = body.email ? String(body.email).toLowerCase().trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const password = String(body.password || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Informe seu nome completo." }, { status: 400 });
  }
  if (cpfNorm.length !== 11) {
    return NextResponse.json({ error: "CPF inválido. Confira os números digitados (11 dígitos)." }, { status: 400 });
  }

  try {
    // Evita cadastro duplicado (ex.: conta já criada pelo médico).
    const existing = await findByCpfAny(cpfNorm);
    if (existing) {
      return NextResponse.json(
        { error: "Este CPF já possui uma conta. Use a opção Entrar (senha inicial 123456, se criada pelo seu médico)." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password || "123456", 10);
    const patient = await createPatient({
      doctorId: "", // conta criada pelo próprio paciente (sem médico vinculado ainda)
      name,
      cpf: cpfNorm,
      email: email || null,
      phone: phone || null,
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
  } catch (error) {
    // Detalhe técnico só nos logs; usuário recebe mensagem amigável.
    console.error("Erro ao criar paciente:", error);
    return NextResponse.json(
      { error: "Não foi possível criar sua conta agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
