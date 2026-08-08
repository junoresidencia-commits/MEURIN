import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getPatient } from "@/lib/patients-store";
import { getDoctorById, readDb } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import {
  createEnrollment,
  listEnrollmentsByPatient,
  logPlansAudit,
  updateEnrollment,
} from "@/lib/plans-store";
import { activateEnrollment, buildServicePricing, processEnrollmentLifecycle } from "@/lib/plan-billing";
import { createPlanPreference, isMercadoPagoEnabledFor } from "@/lib/payments";
import type { PlanPaymentMethod } from "@/lib/plans";

async function resolvePatientName(subject: string): Promise<string> {
  if (subject.startsWith("pid:")) {
    const p = await getPatient(subject.slice(4));
    if (p?.name) return p.name;
  }
  if (subject.includes("@")) {
    const db = await readDb();
    const booking = db.bookings.find((b) => b.patientEmail === subject && b.patientName);
    if (booking) return booking.patientName;
    return subject.split("@")[0];
  }
  return "Paciente";
}

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const enrollments = await processEnrollmentLifecycle(await listEnrollmentsByPatient(subject));
  // Anexa o nome do médico para exibição.
  const withDoctor = await Promise.all(
    enrollments.map(async (e) => {
      const doctor = await getDoctorById(e.doctorId);
      return { ...e, doctorName: doctor?.name ?? e.doctorName };
    })
  );
  return NextResponse.json({ enrollments: withDoctor });
}

const VALID_METHODS: PlanPaymentMethod[] = ["pix", "card", "pix_direto"];

/** Contrata um plano: cria a contratação (aguardando pagamento) e inicia o pagamento. */
export async function POST(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const planId = String(b.planId || "");
  const method: PlanPaymentMethod = VALID_METHODS.includes(b.method) ? b.method : "pix";
  if (!doctorId || !planId) {
    return NextResponse.json({ error: "doctorId e planId obrigatórios." }, { status: 400 });
  }

  // Preço/desconto recalculados no backend — nunca confiar em valores do frontend.
  const pricing = await buildServicePricing({
    doctorId,
    serviceType: "plan",
    planId,
    couponCode: b.couponCode ? String(b.couponCode) : undefined,
    patientKey: subject,
  });
  if (!pricing.ok || !pricing.snapshot) {
    return NextResponse.json({ error: pricing.error || "Não foi possível calcular o preço." }, { status: 400 });
  }

  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  const patientName = await resolvePatientName(subject);

  const enrollment = await createEnrollment({
    doctorId,
    doctorName: doctor.name,
    patientKey: subject,
    patientName,
    planId,
    planName: pricing.planName ?? "Plano",
    source: b.previousEnrollmentId ? "renovacao" : "publico",
    previousEnrollmentId: b.previousEnrollmentId ? String(b.previousEnrollmentId) : undefined,
    durationLabel: pricing.durationLabel ?? "",
    durationDays: pricing.durationDays ?? 30,
    consultationsTotal: pricing.consultations ?? 1,
    consultationsUsed: 0,
    status: "aguardando_pagamento",
    statusHistory: [{ status: "aguardando_pagamento", at: new Date().toISOString(), by: `paciente:${subject}` }],
    pricing: pricing.snapshot,
    paymentMethod: method,
  });
  await logPlansAudit({
    actor: "paciente",
    actorId: subject,
    doctorId,
    action: "enrollment.create",
    entity: "plan_enrollment",
    entityId: enrollment.id,
    detail: { planId, method, finalPriceCents: pricing.snapshot.finalPriceCents, couponId: pricing.snapshot.couponId, promotionId: pricing.snapshot.promotionId },
  });

  // Pix direto: NÃO ativar. O médico confirma o recebimento manualmente.
  if (method === "pix_direto") {
    await updateEnrollment(enrollment.id, {
      status: "aguardando_confirmacao",
      statusHistory: [...enrollment.statusHistory, { status: "aguardando_confirmacao", at: new Date().toISOString(), by: `paciente:${subject}` }],
    });
    if (doctor.email) {
      await sendEmail({
        to: doctor.email,
        subject: `Pix direto — confirmar recebimento (${patientName})`,
        body: `${patientName} informou pagamento por Pix direto do plano "${enrollment.planName}" (R$ ${(pricing.snapshot.finalPriceCents / 100).toFixed(2)}). Verifique sua conta e confirme o recebimento no painel para ativar o plano.`,
      });
    }
    return NextResponse.json({
      enrollmentId: enrollment.id,
      status: "aguardando_confirmacao",
      provider: "pix_direto",
      pixKey: doctor.pixKey?.trim() || null,
      doctorName: doctor.name,
      amountCents: pricing.snapshot.finalPriceCents,
    });
  }

  // Pix online / cartão pelo Mercado Pago: confirmação só pelo webhook.
  if (isMercadoPagoEnabledFor(doctor) && (method === "pix" || method === "card")) {
    try {
      const { redirectUrl } = await createPlanPreference(enrollment, doctor);
      return NextResponse.json({ enrollmentId: enrollment.id, provider: "mercadopago", redirectUrl });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Falha no pagamento." },
        { status: 502 }
      );
    }
  }

  // Modo demonstração (sem Mercado Pago): ativa na hora.
  const activated = await activateEnrollment(enrollment.id, { by: "demo" });
  return NextResponse.json({ enrollmentId: enrollment.id, status: "ativo", provider: "simulado", enrollment: activated });
}
