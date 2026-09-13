import { NextResponse } from "next/server";
import { requireClinicCheckout } from "@/lib/platform-access";
import { listEncounters, recordCheckIn } from "@/lib/clinic-finance-store";
import { writeAudit } from "@/lib/platform-store";
import type { ClinicPaymentMethod } from "@/lib/platform-types";

const METHODS: ClinicPaymentMethod[] = ["pix", "card", "cash", "courtesy", "other"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCheckout(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const encounters = await listEncounters(id);
  return NextResponse.json({
    encounters: encounters.filter((e) => e.paymentStatus === "pending" || e.paymentStatus === "partial"),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCheckout(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const method = String(body.method || "pix") as ClinicPaymentMethod;
  if (!METHODS.includes(method)) return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });
  try {
    const result = await recordCheckIn({
      clinicId: id,
      encounterId: String(body.encounterId || ""),
      method,
      amountCents: Number(body.amountCents || 0),
      discountCents: Number(body.discountCents || 0),
      note: body.note ? String(body.note) : undefined,
      recordedByKind: staff.kind,
      recordedById: staff.actorId,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "clinic_checkin",
      entity: "clinic_payment",
      entityId: result.payment.id,
      detail: `${method} · ${(result.payment.amountCents / 100).toFixed(2)}`,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Check-in não registrado." }, { status: 400 });
  }
}
