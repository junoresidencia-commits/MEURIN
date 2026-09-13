import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { addMembership, getClinic, grantRole, listMemberships, writeAudit } from "@/lib/platform-store";
import { readDb } from "@/lib/store";
import type { PlatformRole } from "@/lib/platform-types";

const ASSIGNABLE: PlatformRole[] = ["ADMIN_CLINICA", "MEDICO"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const clinic = await getClinic(id);
  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  const memberships = await listMemberships(id);
  const db = await readDb();
  const members = memberships.map((m) => {
    const doc = m.actorKind === "doctor" ? db.doctors.find((d) => d.id === m.actorId) : null;
    return {
      ...m,
      name: doc?.name || null,
      email: doc?.email || null,
    };
  });
  return NextResponse.json({ clinic, members });
}

/** Super-admin nomeia gestora ou médico já existente. Não cria usuário novo. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const clinic = await getClinic(id);
  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const role = String(body.role || "ADMIN_CLINICA") as PlatformRole;
  if (!ASSIGNABLE.includes(role)) return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  const db = await readDb();
  const doctor = db.doctors.find((d) => d.email.toLowerCase() === email);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado. Use o e-mail já cadastrado — não criamos conta nova." }, { status: 404 });
  const membership = await addMembership({ clinicId: id, actorKind: "doctor", actorId: doctor.id, role });
  if (role === "ADMIN_CLINICA") await grantRole("doctor", doctor.id, "ADMIN_CLINICA", actor.doctorId);
  await writeAudit({
    actorKind: "doctor",
    actorId: actor.doctorId,
    actorEmail: actor.email,
    action: "assign_clinic_role",
    entity: "clinic_membership",
    entityId: membership.id,
    detail: `${role} para ${doctor.email} em ${clinic.name}. ID do médico preservado: ${doctor.id}`,
  });
  return NextResponse.json({ membership, doctorId: doctor.id }, { status: 201 });
}
