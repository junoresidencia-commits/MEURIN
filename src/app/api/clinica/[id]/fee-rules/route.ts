import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listFeeRules, upsertFeeRule } from "@/lib/clinic-finance-store";
import { writeAudit } from "@/lib/platform-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const rules = await listFeeRules(id);
  return NextResponse.json({ rules });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const doctorId = String(body.doctorId || "");
  const feeCents = Math.round(Number(body.feeCents ?? 0));
  const clinicSharePercent = Number(body.clinicSharePercent ?? 0);
  if (!doctorId) return NextResponse.json({ error: "Médico obrigatório." }, { status: 400 });
  if (!Number.isFinite(feeCents) || feeCents < 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  if (!Number.isFinite(clinicSharePercent) || clinicSharePercent < 0 || clinicSharePercent > 100) {
    return NextResponse.json({ error: "Percentual da clínica deve ser 0–100." }, { status: 400 });
  }
  const rule = await upsertFeeRule({ clinicId: id, doctorId, feeCents, clinicSharePercent });
  await writeAudit({
    actorKind: staff.kind,
    actorId: staff.actorId,
    actorEmail: staff.email,
    action: "upsert_fee_rule",
    entity: "clinic_fee_rule",
    entityId: rule.id,
    detail: `R$ ${(feeCents / 100).toFixed(2)} · clínica ${clinicSharePercent}%`,
  });
  return NextResponse.json({ rule });
}
