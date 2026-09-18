import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listMemberships, updateMembershipPermissions, writeAudit } from "@/lib/platform-store";
import { CLINIC_CASH_PERM_KEYS, CLINIC_STOCK_PERM_KEYS } from "@/lib/platform-types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const members = await listMemberships(id);
  const member = members.find((m) => m.id === memberId);
  if (!member) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const raw = (body.permissions && typeof body.permissions === "object" ? body.permissions : {}) as Record<string, unknown>;
  const permissions: Record<string, boolean> = {};
  for (const key of [...CLINIC_CASH_PERM_KEYS, ...CLINIC_STOCK_PERM_KEYS]) {
    if (key in raw) permissions[key] = Boolean(raw[key]);
  }
  const updated = await updateMembershipPermissions(memberId, permissions);
  await writeAudit({
    actorKind: staff.kind,
    actorId: staff.actorId,
    actorEmail: staff.email,
    action: "clinic_member_permissions",
    entity: "clinic_membership",
    entityId: memberId,
    detail: `${staff.clinic.name} · ${JSON.stringify(permissions)}`,
  });
  return NextResponse.json({ membership: updated });
}
