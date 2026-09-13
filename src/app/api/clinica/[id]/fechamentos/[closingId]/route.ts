import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { addClosingAdjustment, getClosing, listAdjustments, markClosingPaid, netDoctorPayout } from "@/lib/clinic-closing-store";
import { listEncounters } from "@/lib/clinic-finance-store";
import { writeAudit } from "@/lib/platform-store";
import { readDb } from "@/lib/store";
import type { AdjustmentKind } from "@/lib/platform-types";

const KINDS: AdjustmentKind[] = ["credit", "debit", "correction"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; closingId: string }> }) {
  const { id, closingId } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const closing = await getClosing(closingId);
  if (!closing || closing.clinicId !== id) return NextResponse.json({ error: "Fechamento não encontrado." }, { status: 404 });
  const [adjustments, allEnc] = await Promise.all([listAdjustments(closing.id), listEncounters(id)]);
  const encounters = allEnc.filter((e) => closing.encounterIds.includes(e.id));
  const db = await readDb();
  return NextResponse.json({
    closing: {
      ...closing,
      doctorName: db.doctors.find((d) => d.id === closing.doctorId)?.name || "Médico",
      netCents: netDoctorPayout(closing, adjustments),
    },
    adjustments,
    encounters,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; closingId: string }> }) {
  const { id, closingId } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    if (action === "pay") {
      const closing = await markClosingPaid(closingId, staff.actorId);
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "pay_closing",
        entity: "clinic_closing",
        entityId: closing.id,
        detail: closing.code,
      });
      return NextResponse.json({ closing });
    }
    if (action === "adjust") {
      const kind = String(body.kind || "correction") as AdjustmentKind;
      if (!KINDS.includes(kind)) return NextResponse.json({ error: "Tipo de ajuste inválido." }, { status: 400 });
      const adj = await addClosingAdjustment({
        closingId,
        clinicId: id,
        kind,
        amountCents: Number(body.amountCents || 0),
        reason: String(body.reason || ""),
        createdByKind: staff.kind,
        createdById: staff.actorId,
        createdByEmail: staff.email ?? undefined,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "adjust_closing",
        entity: "clinic_closing_adjustment",
        entityId: adj.id,
        detail: `${kind} ${adj.amountCents} · ${adj.reason}`,
      });
      return NextResponse.json({ adjustment: adj }, { status: 201 });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir." }, { status: 400 });
  }
}
