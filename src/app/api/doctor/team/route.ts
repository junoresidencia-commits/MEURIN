import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  DEFAULT_ATTENDANT_PASSWORD, createAttendant, deleteLink, findAttendantByCpfOrEmail,
  listLinksForDoctor, normalizeCpf, setLink, upsertLink, type AttendantPermissions,
} from "@/lib/attendants-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const links = await listLinksForDoctor(doctorId);
  return NextResponse.json({
    team: links.map((l) => ({
      attendantId: l.attendantId,
      name: l.attendant.name,
      cpf: l.attendant.cpf,
      email: l.attendant.email,
      phone: l.attendant.phone,
      whatsapp: l.attendant.whatsapp,
      active: l.active,
      permissions: l.permissions,
      lastAccessAt: l.attendant.lastAccessAt,
    })),
  });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const cpf = b.cpf ? String(b.cpf) : null;
  const email = b.email ? String(b.email).trim() : null;
  if (!name) return NextResponse.json({ error: "Informe o nome da atendente." }, { status: 400 });
  if (!cpf && !email) return NextResponse.json({ error: "Informe CPF e/ou e-mail." }, { status: 400 });
  if (cpf && normalizeCpf(cpf).length < 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });

  const permissions = (b.permissions ?? undefined) as Partial<AttendantPermissions> | undefined;

  // Não duplicar: se já existe conta com esse CPF/e-mail, só cria o VÍNCULO.
  const existing = await findAttendantByCpfOrEmail(cpf, email);
  if (existing) {
    await upsertLink(existing.id, doctorId, permissions);
    return NextResponse.json({ ok: true, attendantId: existing.id, linked: true, message: "Atendente já tinha cadastro no Meu Rim — vinculada à sua equipe." });
  }

  const created = await createAttendant({ name, cpf, email, phone: b.phone ? String(b.phone) : null, whatsapp: b.whatsapp ? String(b.whatsapp) : null });
  await upsertLink(created.id, doctorId, permissions);
  return NextResponse.json({
    ok: true, attendantId: created.id, created: true,
    // Senha padrão para a atendente entrar (troque no primeiro acesso). Mostrada só na criação.
    defaultPassword: DEFAULT_ATTENDANT_PASSWORD,
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const attendantId = String(b.attendantId || "");
  if (!attendantId) return NextResponse.json({ error: "Atendente inválida." }, { status: 400 });
  const updated = await setLink(attendantId, doctorId, {
    active: typeof b.active === "boolean" ? b.active : undefined,
    permissions: b.permissions && typeof b.permissions === "object" ? b.permissions : undefined,
  });
  if (!updated) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const attendantId = String(b.attendantId || "");
  if (!attendantId) return NextResponse.json({ error: "Atendente inválida." }, { status: 400 });
  await deleteLink(attendantId, doctorId);
  return NextResponse.json({ ok: true });
}
