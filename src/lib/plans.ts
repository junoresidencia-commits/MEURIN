// Tipos e regras de PREÇO/DESCONTO para o módulo de Planos, Promoções e Cupons.
// Este arquivo é client-safe (sem "server-only"): pode ser importado no navegador
// para exibir preços, mas o cálculo autoritativo é sempre refeito no backend.

import { computeSplit } from "./types";

export type ServiceType = "consulta" | "plan";

export type PlanDurationKind = "30d" | "3m" | "6m" | "12m" | "custom";
export type PlanModality = "presencial" | "teleconsulta" | "ambas";
export type PlanAvailability = "publico" | "selecionados" | "convite";
export type PlanStatus = "ativo" | "rascunho" | "pausado";

export type DiscountType = "percent" | "fixed" | "promo_price";
export type PromotionScope = "consulta" | "all_plans" | "consulta_plans" | "selected_plans";
export type PromotionStatus = "ativa" | "pausada" | "encerrada";

export type EnrollmentStatus =
  | "rascunho"
  | "aguardando_pagamento"
  | "aguardando_confirmacao"
  | "ativo"
  | "suspenso"
  | "expirado"
  | "cancelado"
  | "concluido";

export type PlanPaymentMethod = "pix" | "card" | "pix_direto";

/** Itens que podem ser marcados como incluídos no plano. */
export const PLAN_INCLUDED_ITEMS: { key: string; label: string }[] = [
  { key: "consulta_inicial", label: "Consulta inicial" },
  { key: "consultas_acompanhamento", label: "Consultas de acompanhamento" },
  { key: "retornos", label: "Retornos programados" },
  { key: "avaliacao_exames", label: "Avaliação de exames durante consulta/retorno" },
  { key: "solicitacao_exames", label: "Solicitações de exames" },
  { key: "receitas", label: "Receitas" },
  { key: "relatorios", label: "Relatórios médicos quando indicados" },
  { key: "acomp_pa", label: "Acompanhamento de pressão arterial" },
  { key: "acomp_glicemia", label: "Acompanhamento de glicemia" },
  { key: "acomp_funcao_renal", label: "Acompanhamento da função renal" },
  { key: "acomp_laboratorio", label: "Acompanhamento de exames laboratoriais" },
  { key: "orientacoes", label: "Orientações cadastradas no aplicativo" },
];

export const PLAN_DURATIONS: { kind: PlanDurationKind; label: string; days: number }[] = [
  { kind: "30d", label: "30 dias", days: 30 },
  { kind: "3m", label: "3 meses", days: 90 },
  { kind: "6m", label: "6 meses", days: 180 },
  { kind: "12m", label: "12 meses", days: 365 },
];

export function durationDays(kind: PlanDurationKind, customDays?: number): number {
  if (kind === "custom") return Math.max(1, Math.round(customDays || 30));
  return PLAN_DURATIONS.find((d) => d.kind === kind)?.days ?? 30;
}

export function durationLabel(kind: PlanDurationKind, customDays?: number): string {
  if (kind === "custom") return `${Math.max(1, Math.round(customDays || 30))} dias`;
  return PLAN_DURATIONS.find((d) => d.kind === kind)?.label ?? "30 dias";
}

export interface PlanTemplate {
  id: string;
  doctorId: string;
  name: string;
  description?: string;
  priceCents: number;
  duration: PlanDurationKind;
  customDays?: number;
  consultations: number;
  intervalSuggestion?: string;
  modality: PlanModality;
  availability: PlanAvailability;
  status: PlanStatus;
  included: string[];
  otherBenefits?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: string;
  doctorId: string;
  name: string;
  description?: string;
  scope: PromotionScope;
  planIds?: string[];
  discountType: DiscountType;
  discountValue: number; // percent (0-100) | valor fixo em centavos | preço promocional em centavos
  startAt?: string;
  endAt?: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  doctorId: string;
  code: string; // sempre maiúsculo
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  planIds?: string[];
  startAt?: string;
  endAt?: string;
  maxRedemptions?: number;
  perPatientOnce: boolean;
  newPatientsOnly: boolean;
  redemptions: number;
  active: boolean;
  createdAt: string;
}

export interface PricingSnapshot {
  serviceType: ServiceType;
  originalPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmountCents: number;
  finalPriceCents: number;
  doctorPercent: number;
  platformPercent: number;
  doctorAmountCents: number;
  platformAmountCents: number;
  promotionId: string | null;
  couponId: string | null;
  couponCode: string | null;
  appliedLabel: string | null; // ex.: "Mês da Nefrologia" ou "Cupom NEFRO10"
}

export interface StatusEvent {
  status: EnrollmentStatus;
  at: string;
  by: string;
}

export interface PlanEnrollment {
  id: string;
  doctorId: string;
  doctorName?: string;
  patientKey: string;
  patientName: string;
  planId?: string;
  planName: string;
  source: "publico" | "oferta" | "renovacao";
  previousEnrollmentId?: string;
  durationLabel: string;
  durationDays: number;
  startAt?: string;
  endAt?: string;
  consultationsTotal: number;
  consultationsUsed: number;
  status: EnrollmentStatus;
  statusHistory: StatusEvent[];
  pricing: PricingSnapshot;
  paymentMethod: PlanPaymentMethod;
  paymentId?: string;
  paidAt?: string;
  renewalNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientOffer {
  id: string;
  doctorId: string;
  doctorName?: string;
  patientKey: string;
  patientName: string;
  offerType: ServiceType;
  planName: string;
  description?: string;
  durationKind?: PlanDurationKind;
  customDays?: number;
  consultations?: number;
  originalPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  finalPriceCents: number;
  validUntil?: string;
  status: "enviada" | "aceita" | "recusada" | "expirada" | "paga";
  enrollmentId?: string;
  createdAt: string;
}

// ---------- Motor de desconto (puro) ----------

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Aplica um desconto a um preço base. Nunca gera preço negativo nem desconto > 100%.
 * Retorna o valor do desconto e o preço final (ambos em centavos).
 */
export function computeDiscount(
  originalCents: number,
  type: DiscountType,
  value: number
): { discountAmountCents: number; finalPriceCents: number } {
  const original = Math.max(0, Math.round(originalCents));
  let discount = 0;
  if (type === "percent") {
    const pct = clampInt(value, 0, 100);
    discount = Math.round((original * pct) / 100);
  } else if (type === "fixed") {
    discount = clampInt(value, 0, original);
  } else {
    // promo_price: value é o preço final desejado
    const finalWanted = clampInt(value, 0, original);
    discount = original - finalWanted;
  }
  discount = clampInt(discount, 0, original);
  return { discountAmountCents: discount, finalPriceCents: original - discount };
}

/** A promoção está vigente agora? (status ativa + dentro da janela de datas) */
export function isPromotionActive(promo: Pick<Promotion, "status" | "startAt" | "endAt">, now = new Date()): boolean {
  if (promo.status !== "ativa") return false;
  const t = now.getTime();
  if (promo.startAt && t < new Date(promo.startAt).getTime()) return false;
  if (promo.endAt && t > new Date(promo.endAt).getTime()) return false;
  return true;
}

/** Status efetivo para exibição (considera janela de datas mesmo se status = ativa). */
export function effectivePromotionStatus(
  promo: Pick<Promotion, "status" | "startAt" | "endAt">,
  now = new Date()
): "ativa" | "agendada" | "pausada" | "encerrada" {
  if (promo.status === "pausada") return "pausada";
  if (promo.status === "encerrada") return "encerrada";
  const t = now.getTime();
  if (promo.startAt && t < new Date(promo.startAt).getTime()) return "agendada";
  if (promo.endAt && t > new Date(promo.endAt).getTime()) return "encerrada";
  return "ativa";
}

/**
 * Monta o snapshot financeiro completo (imutável) de uma cobrança.
 * `doctorPercent` é o repasse do médico (definido pelo ADMIN) para este serviço.
 * O split é sempre calculado sobre o VALOR FINAL efetivamente cobrado.
 */
export function buildPricingSnapshot(input: {
  serviceType: ServiceType;
  originalPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  doctorPercent: number;
  promotionId?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  appliedLabel?: string | null;
}): PricingSnapshot {
  const original = Math.max(0, Math.round(input.originalPriceCents));
  const applied =
    input.discountType && input.discountValue != null
      ? computeDiscount(original, input.discountType, input.discountValue)
      : { discountAmountCents: 0, finalPriceCents: original };
  const doctorPercent = clampInt(input.doctorPercent, 0, 100);
  const { doctorPayoutCents, platformFeeCents } = computeSplit(applied.finalPriceCents, doctorPercent);
  return {
    serviceType: input.serviceType,
    originalPriceCents: original,
    discountType: input.discountType,
    discountValue: input.discountValue,
    discountAmountCents: applied.discountAmountCents,
    finalPriceCents: applied.finalPriceCents,
    doctorPercent,
    platformPercent: 100 - doctorPercent,
    doctorAmountCents: doctorPayoutCents,
    platformAmountCents: platformFeeCents,
    promotionId: input.promotionId ?? null,
    couponId: input.couponId ?? null,
    couponCode: input.couponCode ?? null,
    appliedLabel: input.appliedLabel ?? null,
  };
}

/** A promoção/cupom se aplica a este serviço? */
export function scopeApplies(
  scope: PromotionScope,
  serviceType: ServiceType,
  planId: string | undefined,
  planIds: string[] | undefined
): boolean {
  if (serviceType === "consulta") return scope === "consulta" || scope === "consulta_plans";
  // plan
  if (scope === "all_plans" || scope === "consulta_plans") return true;
  if (scope === "selected_plans") return Boolean(planId && planIds?.includes(planId));
  return false;
}
