import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import {
  findByEmailAny,
  getPatient,
  setPatientPassword,
  verifyPatientPassword,
} from "@/lib/patients-store";

export async function POST(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) {
    return NextResponse.json({ error: "Sessão de paciente não encontrada." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const current = String(body.currentPassword || "");
  const next = String(body.newPassword || "");

  // Regras de segurança da nova senha.
  if (next.length < 8) {
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (next === "123456") {
    return NextResponse.json({ error: "Escolha uma senha diferente de 123456." }, { status: 400 });
  }

  // Descobre o cadastro do paciente a partir do "subject" da sessão
  // (pode ser "pid:<id>" ou o e-mail do paciente criado pelo médico).
  const patient = subject.startsWith("pid:")
    ? await getPatient(subject.slice(4))
    : await findByEmailAny(subject);

  if (!patient) {
    return NextResponse.json(
      { error: "Troca de senha disponível apenas para pacientes cadastrados pelo médico." },
      { status: 400 }
    );
  }

  // No 1º acesso obrigatório, a sessão já autentica o paciente — não pede a senha atual.
  // Fora disso, exige a senha atual para confirmar a identidade.
  if (!patient.mustChangePassword) {
    const ok = await verifyPatientPassword(patient, current);
    if (!ok) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
    }
  }

  await setPatientPassword(patient.id, next);
  return NextResponse.json({ ok: true });
}
