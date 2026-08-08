import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getPatient, findByEmailAny, updatePatient } from "@/lib/patients-store";

async function resolveSelf(subject: string) {
  return subject.startsWith("pid:") ? getPatient(subject.slice(4)) : findByEmailAny(subject);
}

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const p = await resolveSelf(subject);
  if (!p) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    patient: { name: p.name, cpf: p.cpf ?? "", phone: p.phone ?? "", email: p.email ?? "", birthdate: p.birthdate ?? "", sex: p.sex ?? "" },
  });
}

export async function PUT(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const p = await resolveSelf(subject);
  if (!p) {
    return NextResponse.json({ error: "Cadastro não encontrado para editar." }, { status: 400 });
  }
  let body: { name?: unknown; phone?: unknown; birthdate?: unknown; sex?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const name = String(body.name ?? p.name).trim() || p.name;
  // E-mail e CPF não são editados aqui (chave clínica / identidade); alterar na consulta.
  await updatePatient(p.id, {
    name,
    phone: body.phone !== undefined ? String(body.phone) : p.phone,
    birthdate: body.birthdate !== undefined ? String(body.birthdate) : p.birthdate,
    sex: body.sex !== undefined ? String(body.sex) : p.sex,
  });
  return NextResponse.json({ ok: true });
}
