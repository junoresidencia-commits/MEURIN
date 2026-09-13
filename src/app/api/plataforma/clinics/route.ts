import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { createClinic, listClinics, writeAudit } from "@/lib/platform-store";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const clinics = await listClinics();
  return NextResponse.json({ clinics });
}

export async function POST(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nome da clínica é obrigatório." }, { status: 400 });
  const clinic = await createClinic({
    name,
    legalName: body.legalName ? String(body.legalName) : undefined,
    cnpj: body.cnpj ? String(body.cnpj) : undefined,
    city: body.city ? String(body.city) : undefined,
  });
  await writeAudit({
    actorKind: "doctor",
    actorId: actor.doctorId,
    actorEmail: actor.email,
    action: "create_clinic",
    entity: "clinic",
    entityId: clinic.id,
    detail: clinic.name,
  });
  return NextResponse.json({ clinic }, { status: 201 });
}
