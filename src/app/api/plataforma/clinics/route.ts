import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { CLINIC_STATUSES } from "@/lib/platform-types";
import { createClinic, listClinics, updateClinicStatus, writeAudit } from "@/lib/platform-store";

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
    status: body.status === "pilot" ? "pilot" : undefined,
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

export async function PATCH(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "") as (typeof CLINIC_STATUSES)[number];
  if (!id) return NextResponse.json({ error: "Clínica obrigatória." }, { status: 400 });
  if (!CLINIC_STATUSES.includes(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  try {
    const clinic = await updateClinicStatus(id, status);
    await writeAudit({
      actorKind: "doctor",
      actorId: actor.doctorId,
      actorEmail: actor.email,
      action: "update_clinic_status",
      entity: "clinic",
      entityId: clinic.id,
      detail: `${clinic.name} → ${status}`,
    });
    return NextResponse.json({ clinic });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível atualizar." }, { status: 400 });
  }
}
