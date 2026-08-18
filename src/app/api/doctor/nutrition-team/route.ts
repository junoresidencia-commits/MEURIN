import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  DEFAULT_NUTRITIONIST_PASSWORD, createNutritionist, deleteNutritionLink, findNutritionistByCpfOrEmail,
  listNutritionLinksForDoctor, normalizeCpf, setNutritionLink, upsertNutritionLink,
} from "@/lib/nutritionists-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const links = await listNutritionLinksForDoctor(doctorId);
  return NextResponse.json({
    team: links.map((l) => ({
      nutritionistId: l.nutritionistId,
      name: l.nutritionist.name,
      cpf: l.nutritionist.cpf,
      email: l.nutritionist.email,
      phone: l.nutritionist.phone,
      crn: l.nutritionist.crn,
      uf: l.nutritionist.uf,
      active: l.active,
      permissions: l.permissions,
      status: l.nutritionist.status,
      lastAccessAt: l.nutritionist.lastAccessAt,
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
  if (!name) return NextResponse.json({ error: "Informe o nome da nutricionista." }, { status: 400 });
  if (!cpf && !email) return NextResponse.json({ error: "Informe CPF e/ou e-mail." }, { status: 400 });
  if (cpf && normalizeCpf(cpf).length < 11) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });

  const permissions = (b.permissions && typeof b.permissions === "object") ? b.permissions : undefined;

  // Não duplicar: se já existe conta com esse CPF/e-mail, só cria o VÍNCULO.
  const existing = await findNutritionistByCpfOrEmail(cpf, email);
  if (existing) {
    await upsertNutritionLink(existing.id, doctorId, permissions);
    return NextResponse.json({ ok: true, nutritionistId: existing.id, linked: true, message: "Nutricionista já tinha cadastro no Meu Rim — vinculada à sua equipe." });
  }

  const created = await createNutritionist({
    name, cpf, email,
    phone: b.phone ? String(b.phone) : null,
    crn: b.crn ? String(b.crn) : null,
    uf: b.uf ? String(b.uf) : null,
  });
  await upsertNutritionLink(created.id, doctorId, permissions);
  return NextResponse.json({
    ok: true, nutritionistId: created.id, created: true,
    defaultPassword: DEFAULT_NUTRITIONIST_PASSWORD,
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const nutritionistId = String(b.nutritionistId || "");
  if (!nutritionistId) return NextResponse.json({ error: "Nutricionista inválida." }, { status: 400 });
  const updated = await setNutritionLink(nutritionistId, doctorId, {
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
  const nutritionistId = String(b.nutritionistId || "");
  if (!nutritionistId) return NextResponse.json({ error: "Nutricionista inválida." }, { status: 400 });
  await deleteNutritionLink(nutritionistId, doctorId);
  return NextResponse.json({ ok: true });
}
