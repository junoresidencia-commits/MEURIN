import "server-only";

import { getDoctorById } from "./store";
import { resolveServiceSharePercent } from "./types";
import { sendEmail } from "./email";
import {
  buildPricingSnapshot,
  durationDays as durationDaysFor,
  durationLabel as durationLabelFor,
  isPromotionActive,
  scopeApplies,
  type PricingSnapshot,
  type PlanEnrollment,
  type ServiceType,
} from "./plans";
import {
  countPatientRedemptions,
  getCouponByCode,
  getEnrollment,
  getPlan,
  listEnrollmentsByPatient,
  listPromotionsByDoctor,
  logPlansAudit,
  redeemCoupon,
  updateEnrollment,
} from "./plans-store";

export interface PricingResult {
  ok: boolean;
  error?: string;
  snapshot?: PricingSnapshot;
  planName?: string;
  durationLabel?: string;
  durationDays?: number;
  consultations?: number;
}

/** O paciente é "novo" para este médico? (sem contratação paga anterior) */
async function isNewPatientForDoctor(patientKey: string, doctorId: string): Promise<boolean> {
  const prior = await listEnrollmentsByPatient(patientKey);
  const paidStatuses = ["ativo", "concluido", "expirado", "suspenso"];
  return !prior.some((e) => e.doctorId === doctorId && paidStatuses.includes(e.status));
}

/**
 * Calcula o preço FINAL e o snapshot financeiro de forma autoritativa no backend.
 * Regra: apenas UMA condição comercial por compra. Se um cupom for informado, ele
 * tem prioridade (e deve ser válido); caso contrário, aplica-se a promoção vigente.
 */
export async function buildServicePricing(params: {
  doctorId: string;
  serviceType: ServiceType;
  planId?: string;
  couponCode?: string;
  patientKey: string;
}): Promise<PricingResult> {
  const doctor = await getDoctorById(params.doctorId);
  if (!doctor) return { ok: false, error: "Médico não encontrado." };

  let basePrice = 0;
  let planName = "Consulta avulsa";
  let durLabel = "";
  let durDays = 0;
  let consultations = 1;

  if (params.serviceType === "plan") {
    if (!params.planId) return { ok: false, error: "Plano não informado." };
    const plan = await getPlan(params.planId);
    if (!plan || plan.doctorId !== params.doctorId) {
      return { ok: false, error: "Plano não encontrado." };
    }
    if (plan.status !== "ativo") return { ok: false, error: "Plano indisponível." };
    basePrice = plan.priceCents;
    planName = plan.name;
    durLabel = durationLabelFor(plan.duration, plan.customDays);
    durDays = durationDaysFor(plan.duration, plan.customDays);
    consultations = plan.consultations;
  } else {
    basePrice = doctor.consultationPriceCents;
  }

  const doctorPercent = resolveServiceSharePercent(doctor, params.serviceType);

  let discountType: PricingSnapshot["discountType"] = null;
  let discountValue: PricingSnapshot["discountValue"] = null;
  let promotionId: string | null = null;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let appliedLabel: string | null = null;

  const code = params.couponCode?.trim();
  if (code) {
    // Cupom informado: precisa ser válido (senão erro, para o paciente corrigir).
    const coupon = await getCouponByCode(params.doctorId, code);
    if (!coupon) return { ok: false, error: "Cupom inválido." };
    if (!coupon.active) return { ok: false, error: "Cupom inativo." };
    const now = Date.now();
    if (coupon.startAt && now < new Date(coupon.startAt).getTime())
      return { ok: false, error: "Cupom ainda não está válido." };
    if (coupon.endAt && now > new Date(coupon.endAt).getTime())
      return { ok: false, error: "Cupom expirado." };
    if (!scopeApplies(coupon.scope, params.serviceType, params.planId, coupon.planIds))
      return { ok: false, error: "Cupom não se aplica a este serviço." };
    if (typeof coupon.maxRedemptions === "number" && coupon.redemptions >= coupon.maxRedemptions)
      return { ok: false, error: "Cupom esgotado." };
    if (coupon.perPatientOnce) {
      const used = await countPatientRedemptions(coupon.id, params.patientKey);
      if (used > 0) return { ok: false, error: "Você já utilizou este cupom." };
    }
    if (coupon.newPatientsOnly) {
      const isNew = await isNewPatientForDoctor(params.patientKey, params.doctorId);
      if (!isNew) return { ok: false, error: "Cupom válido apenas para novos pacientes." };
    }
    discountType = coupon.discountType;
    discountValue = coupon.discountValue;
    couponId = coupon.id;
    couponCode = coupon.code;
    appliedLabel = `Cupom ${coupon.code}`;
  } else {
    // Sem cupom: aplica a melhor promoção vigente que se aplica ao serviço.
    const promos = await listPromotionsByDoctor(params.doctorId);
    const applicable = promos.filter(
      (p) => isPromotionActive(p) && scopeApplies(p.scope, params.serviceType, params.planId, p.planIds)
    );
    if (applicable.length > 0) {
      // Escolhe a de maior desconto efetivo sobre o preço base.
      let best = applicable[0];
      let bestDiscount = -1;
      for (const p of applicable) {
        const snap = buildPricingSnapshot({
          serviceType: params.serviceType,
          originalPriceCents: basePrice,
          discountType: p.discountType,
          discountValue: p.discountValue,
          doctorPercent,
        });
        if (snap.discountAmountCents > bestDiscount) {
          bestDiscount = snap.discountAmountCents;
          best = p;
        }
      }
      discountType = best.discountType;
      discountValue = best.discountValue;
      promotionId = best.id;
      appliedLabel = best.name;
    }
  }

  const snapshot = buildPricingSnapshot({
    serviceType: params.serviceType,
    originalPriceCents: basePrice,
    discountType,
    discountValue,
    doctorPercent,
    promotionId,
    couponId,
    couponCode,
    appliedLabel,
  });

  return {
    ok: true,
    snapshot,
    planName,
    durationLabel: durLabel,
    durationDays: durDays,
    consultations,
  };
}

function pushStatus(enrollment: PlanEnrollment, status: PlanEnrollment["status"], by: string) {
  return [...enrollment.statusHistory, { status, at: new Date().toISOString(), by }];
}

/**
 * Ativa a contratação após confirmação de pagamento. Idempotente: se já estiver
 * ativa, não faz nada. Consome o cupom (uma vez), define período e notifica.
 */
export async function activateEnrollment(
  enrollmentId: string,
  opts: { paymentId?: string; by?: string } = {}
): Promise<PlanEnrollment | null> {
  const enrollment = await getEnrollment(enrollmentId);
  if (!enrollment) return null;
  if (enrollment.status === "ativo" || enrollment.status === "concluido") {
    return enrollment; // idempotente
  }

  const now = new Date();
  const startAt = now.toISOString();
  const endAt = new Date(now.getTime() + enrollment.durationDays * 24 * 60 * 60 * 1000).toISOString();

  // Consome o cupom apenas na ativação (evita gastar em checkout abandonado).
  if (enrollment.pricing.couponId && !enrollment.paidAt) {
    await redeemCoupon(enrollment.pricing.couponId, enrollment.doctorId, enrollment.patientKey, enrollment.id);
  }

  const updated = await updateEnrollment(enrollmentId, {
    status: "ativo",
    startAt,
    endAt,
    paymentId: opts.paymentId ?? enrollment.paymentId,
    paidAt: startAt,
    statusHistory: pushStatus(enrollment, "ativo", opts.by ?? "sistema"),
  });

  await logPlansAudit({
    actor: "sistema",
    doctorId: enrollment.doctorId,
    action: "enrollment.activate",
    entity: "plan_enrollment",
    entityId: enrollment.id,
    detail: {
      finalPriceCents: enrollment.pricing.finalPriceCents,
      doctorAmountCents: enrollment.pricing.doctorAmountCents,
      platformAmountCents: enrollment.pricing.platformAmountCents,
      paymentMethod: enrollment.paymentMethod,
    },
  });

  // Notificações (e-mail quando houver endereço; caso contrário, log no servidor).
  const doctor = await getDoctorById(enrollment.doctorId);
  if (doctor?.email) {
    await sendEmail({
      to: doctor.email,
      subject: `Plano ativado — ${enrollment.patientName}`,
      body: `O plano "${enrollment.planName}" de ${enrollment.patientName} foi ativado após confirmação do pagamento.`,
    });
  }
  if (enrollment.patientKey.includes("@")) {
    await sendEmail({
      to: enrollment.patientKey,
      subject: `Seu plano de acompanhamento está ativo`,
      body: `Seu plano "${enrollment.planName}" com ${doctor?.name ?? "seu médico"} está ativo até ${new Date(endAt).toLocaleDateString("pt-BR")}.`,
    });
  }

  return updated;
}
