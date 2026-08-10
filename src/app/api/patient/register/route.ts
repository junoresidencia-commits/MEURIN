import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createPatient, findByCpfAny, normalizeCpf, clinicalKey, maskPatientName } from "@/lib/patients-store";
import { createPatientToken, PATIENT_COOKIE } from "@/lib/patient-session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cria a conta do paciente com o mínimo: nome + CPF + senha (opcional → 123456).
 * Se já existir prontuário/cadastro com o CPF (ex.: criado pelo médico),
 * orienta o fluxo seguro de vinculação — sem criar duplicata.
 */
export async function POST(req: Request) {
  let body: { name?: unknown; cpf?: unknown; password?: unknown; email?: unknown; phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Não recebemos os dados do formulário. Tente novamente." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const cpfNorm = normalizeCpf(body.cpf as string);
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
    const existing = await findByCpfAny(cpfNorm);
    if (existing) {
      const needsExtra =
        Boolean(existing.phone && String(existing.phone).replace(/\D/g, "").length >= 8) ||
        Boolean(existing.birthdate && String(existing.birthdate).length >= 8);
      return NextResponse.json(
        {
          error: "Encontramos um cadastro relacionado ao seu CPF.",
          code: "cpf_exists",
          claimable: true,
          maskedName: maskPatientName(existing.name),
          needsPhone: Boolean(existing.phone && String(existing.phone).replace(/\D/g, "").length >= 8),
          needsBirthdate: !needsExtra
            ? false
            : Boolean(existing.birthdate && String(existing.birthdate).length >= 8) &&
              !(existing.phone && String(existing.phone).replace(/\D/g, "").length >= 8),
          hint: "Confirme sua identidade para conectar sua conta ao prontuário existente. Você também pode entrar se já tiver senha.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password || "123456", 10);
    const patient = await createPatient({
      doctorId: "",
      name,
      cpf: cpfNorm,
      email: email || null,
      phone: phone || null,
      passwordHash,
    });

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
    console.error("Erro ao criar paciente:", error);
    return NextResponse.json(
      { error: "Não foi possível criar sua conta agora. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
