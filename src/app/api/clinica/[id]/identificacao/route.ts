import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { updateClinicProfile, writeAudit } from "@/lib/platform-store";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const clinic = await updateClinicProfile(id, {
      name: body.name != null ? String(body.name) : undefined,
      legalName: body.legalName != null ? String(body.legalName) : undefined,
      cnpj: body.cnpj != null ? String(body.cnpj) : undefined,
      city: body.city != null ? String(body.city) : undefined,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "update_clinic_profile",
      entity: "clinic",
      entityId: clinic.id,
      detail: `${clinic.name} · ${clinic.city || "sem município"} · ${clinic.cnpj || "sem CNPJ"}`,
    });
    return NextResponse.json({ clinic });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível salvar os dados da unidade." },
      { status: 400 },
    );
  }
}