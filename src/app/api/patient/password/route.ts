import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import {
  canSkipCurrentPassword,
  findPatientByClinicalKey,
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
  const firstAccess = body.firstAccess === true;

  // Regras de segurança da nova senha.
  if (next.length < 8) {
    return NextResponse.json({ error: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (next === "123456") {
    return NextResponse.json({ error: "Escolha uma senha diferente de 123456." }, { status: 400 });
  }

  const patient = await findPatientByClinicalKey(subject);

  if (!patient) {
    return NextResponse.json(
      { error: "Não encontramos seu cadastro para salvar a senha. Saia e entre de novo." },
      { status: 400 }
    );
  }

  // 1º acesso: a sessão já autentica. Também aceita se a senha ainda é 123456
  // (flag de troca pode não ter sido gravado). Troca normal pede a senha atual.
  if (!(await canSkipCurrentPassword(patient, firstAccess))) {
    const ok = await verifyPatientPassword(patient, current);
    if (!ok) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
    }
  }

  await setPatientPassword(patient.id, next);
  return NextResponse.json({ ok: true });
}
