import { NextResponse } from "next/server";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { getNutritionLink } from "@/lib/nutritionists-store";
import { createAppointment } from "@/lib/nutrition-appointments-store";
import { buildPixBrCode } from "@/lib/pix-brcode";

// Nutricionista agenda uma consulta para o paciente (pagamento por Pix direto).
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (nut.payoutStatus === "blocked") return NextResponse.json({ error: "Seu recebimento está bloqueado. Fale com o administrador." }, { status: 403 });
  const { key } = await params;
  const access = await resolveNutritionPatientAccess(decodeURIComponent(key));
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const link = await getNutritionLink(nut.id, access.doctorId);
  if (link && !link.permissions.criarPlano) {
    return NextResponse.json({ error: "Você não tem permissão para agendar consultas para os pacientes deste médico." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const isReturn = b.isReturn === true;
  const priceReais = b.price !== undefined && b.price !== "" ? Number(b.price) : undefined;
  const priceCents = priceReais !== undefined && Number.isFinite(priceReais)
    ? Math.max(0, Math.round(priceReais * 100))
    : (isReturn ? (nut.returnPriceCents ?? 0) : (nut.consultationPriceCents ?? 0));
  const modality = b.modality === "presencial" ? "presencial" : "teleconsulta";
  const slotStart = b.slotStart ? String(b.slotStart) : null;

  // Snapshot imutável do rateio (comissão da plataforma definida pelo admin).
  const commission = Math.min(100, Math.max(0, Number(nut.commissionPercent ?? 0)));
  const platformFeeCents = Math.round((priceCents * commission) / 100);
  const nutritionistPayoutCents = priceCents - platformFeeCents;

  // Pix copia-e-cola do recebedor (nutricionista), se configurado.
  const pix = nut.pixProfile?.key
    ? buildPixBrCode({ key: nut.pixProfile.key, holderName: nut.pixProfile.holderName, city: nut.pixProfile.city })
    : null;

  const appt = await createAppointment({
    nutritionistId: nut.id, nutritionistName: nut.name, doctorId: access.doctorId,
    patientKey: access.key, patientName: access.name, slotStart, modality, priceCents,
    status: priceCents > 0 ? "aguardando_pagamento" : "confirmada",
    paymentMethod: "pix_direto", pixCopiaCola: pix, proofUrl: null,
    commissionPercent: commission, platformFeeCents, nutritionistPayoutCents,
    note: b.note ? String(b.note) : null,
  });
  return NextResponse.json({ ok: true, appointment: appt }, { status: 201 });
}
