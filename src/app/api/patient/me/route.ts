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
    mustChangePassword: p.mustChangePassword === true,
    patient: { name: p.name, cpf: p.cpf ?? "", phone: p.phone ?? "", email: p.email ?? "", birthdate: p.birthdate ?? "", sex: p.sex ?? "", photoUrl: p.photoUrl ?? "" },
  });
}

export async function PUT(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const p = await resolveSelf(subject);
  if (!p) {
    return NextResponse.json({ error: "Cadastro não encontrado para editar." }, { status: 400 });
  }
  let body: { name?: unknown; phone?: unknown; birthdate?: unknown; sex?: unknown; photoUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const name = String(body.name ?? p.name).trim() || p.name;
  // Foto de perfil (data URL). Guarda de tamanho para não estourar o payload.
  let photoUrl: string | null | undefined;
  if (body.photoUrl !== undefined) {
    const v = String(body.photoUrl || "");
    if (v === "") photoUrl = null;
    else if (v.startsWith("data:image/") && v.length < 900000) photoUrl = v;
    else return NextResponse.json({ error: "Imagem inválida ou muito grande (máx. ~700 KB)." }, { status: 400 });
  }
  // E-mail e CPF não são editados aqui (chave clínica / identidade); alterar na consulta.
  await updatePatient(p.id, {
    name,
    phone: body.phone !== undefined ? String(body.phone) : p.phone,
    birthdate: body.birthdate !== undefined ? String(body.birthdate) : p.birthdate,
    sex: body.sex !== undefined ? String(body.sex) : p.sex,
    ...(photoUrl !== undefined ? { photoUrl } : {}),
  });
  return NextResponse.json({ ok: true });
}
