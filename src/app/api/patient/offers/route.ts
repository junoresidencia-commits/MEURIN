import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getDoctorById } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import {
  createEnrollment,
  getOffer,
  listOffersByPatient,
  logPlansAudit,
  updateEnrollment,
  updateOffer,
} from "@/lib/plans-store";
import { activateEnrollment } from "@/lib/plan-billing";
import { createPlanPreference, isMercadoPagoEnabledFor } from "@/lib/payments";
import { buildPricingSnapshot, durationDays, durationLabel, type PlanPaymentMethod } from "@/lib/plans";
import { resolveServiceSharePercent } from "@/lib/types";

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const offers = (await listOffersByPatient(subject)).map((o) => ({
    ...o,
    expired: Boolean(o.validUntil && Date.now() > new Date(o.validUntil).getTime()),
  }));
  return NextResponse.json({ offers });
}

const VALID_METHODS: PlanPaymentMethod[] = ["pix", "card", "pix_direto"];

/** Paciente aceita uma proposta e paga (cria a contratação com o preço da proposta). */
export async function POST(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const offerId = String(b.offerId || "");
  const method: PlanPaymentMethod = VALID_METHODS.includes(b.method) ? b.method : "pix";
  if (!offerId) return NextResponse.json({ error: "offerId obrigatório." }, { status: 400 });

  const offer = await getOffer(offerId);
  if (!offer || offer.patientKey !== subject) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }
  if (offer.status !== "enviada") {
    return NextResponse.json({ error: "Proposta indisponível." }, { status: 400 });
  }
  if (offer.validUntil && Date.now() > new Date(offer.validUntil).getTime()) {
    await updateOffer(offerId, { status: "expirada" });
    return NextResponse.json({ error: "Proposta expirada." }, { status: 400 });
  }

  const doctor = await getDoctorById(offer.doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  // Snapshot recalculado no backend com o repasse vigente do serviço.
  const doctorPercent = resolveServiceSharePercent(doctor, offer.offerType);
  const snapshot = buildPricingSnapshot({
    serviceType: offer.offerType,
    originalPriceCents: offer.originalPriceCents,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    doctorPercent,
    appliedLabel: "Condição especial",
  });

  const durKind = offer.durationKind ?? "30d";
  const enrollment = await createEnrollment({
    doctorId: offer.doctorId,
    doctorName: doctor.name,
    patientKey: subject,
    patientName: offer.patientName,
    planName: offer.planName,
    source: "oferta",
    durationLabel: offer.offerType === "plan" ? durationLabel(durKind, offer.customDays) : "",
    durationDays: offer.offerType === "plan" ? durationDays(durKind, offer.customDays) : 30,
    consultationsTotal: offer.consultations ?? 1,
    consultationsUsed: 0,
    status: "aguardando_pagamento",
    statusHistory: [{ status: "aguardando_pagamento", at: new Date().toISOString(), by: `paciente:${subject}` }],
    pricing: snapshot,
    paymentMethod: method,
  });
  await updateOffer(offerId, { status: "aceita", enrollmentId: enrollment.id });
  await logPlansAudit({ actor: "paciente", actorId: subject, doctorId: offer.doctorId, action: "offer.accept", entity: "patient_offer", entityId: offerId, detail: { enrollmentId: enrollment.id } });

  if (method === "pix_direto") {
    await updateEnrollment(enrollment.id, {
      status: "aguardando_confirmacao",
      statusHistory: [...enrollment.statusHistory, { status: "aguardando_confirmacao", at: new Date().toISOString(), by: `paciente:${subject}` }],
    });
    if (doctor.email) {
      await sendEmail({
        to: doctor.email,
        subject: `Pix direto — confirmar recebimento (${offer.patientName})`,
        body: `${offer.patientName} aceitou sua proposta e informou Pix direto (R$ ${(snapshot.finalPriceCents / 100).toFixed(2)}). Confirme o recebimento no painel para ativar.`,
      });
    }
    return NextResponse.json({ enrollmentId: enrollment.id, status: "aguardando_confirmacao", provider: "pix_direto" });
  }

  if (isMercadoPagoEnabledFor(doctor) && (method === "pix" || method === "card")) {
    try {
      const { redirectUrl } = await createPlanPreference(enrollment, doctor);
      return NextResponse.json({ enrollmentId: enrollment.id, provider: "mercadopago", redirectUrl });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no pagamento." }, { status: 502 });
    }
  }

  const activated = await activateEnrollment(enrollment.id, { by: "demo" });
  await updateOffer(offerId, { status: "paga" });
  return NextResponse.json({ enrollmentId: enrollment.id, status: "ativo", provider: "simulado", enrollment: activated });
}
