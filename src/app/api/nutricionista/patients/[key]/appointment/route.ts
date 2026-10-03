import { NextResponse } from "next/server";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { getNutritionLink, nutritionFeeRule } from "@/lib/nutritionists-store";
import { createAppointment } from "@/lib/nutrition-appointments-store";
import { buildPixBrCode } from "@/lib/pix-brcode";
import { computePlatformFeeCents } from "@/lib/platform-fees";
import { recordPlatformCharge } from "@/lib/platform-charges-store";

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

  const rule = nutritionFeeRule(nut);
  const commission = rule.commissionPercent;
  const platformFeeCents = computePlatformFeeCents(rule, "atendimento", priceCents);
  const nutritionistPayoutCents = priceCents;

  // Pix copia-e-cola do recebedor (nutricionista), com o valor da consulta na chave dela.
  const pix = nut.pixProfile?.key
    ? buildPixBrCode({
        key: nut.pixProfile.key,
        holderName: nut.pixProfile.holderName || nut.name,
        city: nut.pixProfile.city,
        amountCents: priceCents,
      })
    : null;

  const appt = await createAppointment({
    nutritionistId: nut.id, nutritionistName: nut.name, doctorId: access.doctorId,
    patientKey: access.key, patientName: access.name, slotStart, modality, priceCents,
    status: priceCents > 0 ? "aguardando_pagamento" : "confirmada",
    paymentMethod: "pix_direto", pixCopiaCola: pix, proofUrl: null,
    commissionPercent: commission, platformFeeCents, nutritionistPayoutCents,
    note: b.note ? String(b.note) : isReturn ? "retorno" : null,
  });
  if (appt.status === "confirmada") {
    await recordPlatformCharge({
      actorKind: "nutrition",
      professionalId: nut.id,
      professionalName: nut.name,
      kind: "atendimento",
      sourceId: appt.id,
      rule,
      priceCents,
      note: isReturn ? "retorno" : "consulta nutrição",
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, appointment: appt }, { status: 201 });
}
