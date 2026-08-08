import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type {
  Coupon,
  PatientOffer,
  PlanEnrollment,
  PlanTemplate,
  PricingSnapshot,
  Promotion,
} from "./plans";

const DATA_DIR = path.join(process.cwd(), "data");
const PLANS_PATH = path.join(DATA_DIR, "plans.json");

type LocalDb = {
  planTemplates: PlanTemplate[];
  promotions: Promotion[];
  coupons: Coupon[];
  couponRedemptions: {
    id: string;
    couponId: string;
    doctorId: string;
    patientKey: string;
    enrollmentId?: string;
    createdAt: string;
  }[];
  enrollments: PlanEnrollment[];
  offers: PatientOffer[];
  audit: PlansAudit[];
};

export interface PlansAudit {
  id: string;
  actor: "medico" | "admin" | "paciente" | "sistema";
  actorId?: string;
  doctorId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204"]);
const missingTables = new Set<string>();

function sb(table: string) {
  const admin = getSupabaseAdmin();
  if (!admin || missingTables.has(table)) return null;
  return admin;
}

function handleMissing(table: string, error: { code?: string } | null): boolean {
  if (error && error.code && MISSING_TABLE_CODES.has(error.code)) {
    missingTables.add(table);
    return true;
  }
  return false;
}

async function readLocal(): Promise<LocalDb> {
  try {
    const raw = await fs.readFile(PLANS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return {
      planTemplates: parsed.planTemplates ?? [],
      promotions: parsed.promotions ?? [],
      coupons: parsed.coupons ?? [],
      couponRedemptions: parsed.couponRedemptions ?? [],
      enrollments: parsed.enrollments ?? [],
      offers: parsed.offers ?? [],
      audit: parsed.audit ?? [],
    };
  } catch {
    return {
      planTemplates: [],
      promotions: [],
      coupons: [],
      couponRedemptions: [],
      enrollments: [],
      offers: [],
      audit: [],
    };
  }
}

async function writeLocal(db: LocalDb): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PLANS_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function mutateLocal<T>(fn: (db: LocalDb) => T): Promise<T> {
  const db = await readLocal();
  const result = fn(db);
  await writeLocal(db);
  return result;
}

// ---------- mapeamento snake_case <-> camelCase ----------

function mapPlan(r: Record<string, unknown>): PlanTemplate {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
    priceCents: Number(r.price_cents),
    duration: String(r.duration) as PlanTemplate["duration"],
    customDays: r.custom_days == null ? undefined : Number(r.custom_days),
    consultations: Number(r.consultations),
    intervalSuggestion: r.interval_suggestion ? String(r.interval_suggestion) : undefined,
    modality: String(r.modality) as PlanTemplate["modality"],
    availability: String(r.availability) as PlanTemplate["availability"],
    status: String(r.status) as PlanTemplate["status"],
    included: Array.isArray(r.included) ? (r.included as string[]) : [],
    otherBenefits: r.other_benefits ? String(r.other_benefits) : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

function planToRow(p: PlanTemplate) {
  return {
    id: p.id,
    doctor_id: p.doctorId,
    name: p.name,
    description: p.description ?? null,
    price_cents: p.priceCents,
    duration: p.duration,
    custom_days: p.customDays ?? null,
    consultations: p.consultations,
    interval_suggestion: p.intervalSuggestion ?? null,
    modality: p.modality,
    availability: p.availability,
    status: p.status,
    included: p.included,
    other_benefits: p.otherBenefits ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function mapPromotion(r: Record<string, unknown>): Promotion {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    name: String(r.name),
    description: r.description ? String(r.description) : undefined,
    scope: String(r.scope) as Promotion["scope"],
    planIds: Array.isArray(r.plan_ids) ? (r.plan_ids as string[]) : [],
    discountType: String(r.discount_type) as Promotion["discountType"],
    discountValue: Number(r.discount_value),
    startAt: r.start_at ? new Date(String(r.start_at)).toISOString() : undefined,
    endAt: r.end_at ? new Date(String(r.end_at)).toISOString() : undefined,
    status: String(r.status) as Promotion["status"],
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

function promotionToRow(p: Promotion) {
  return {
    id: p.id,
    doctor_id: p.doctorId,
    name: p.name,
    description: p.description ?? null,
    scope: p.scope,
    plan_ids: p.planIds ?? [],
    discount_type: p.discountType,
    discount_value: p.discountValue,
    start_at: p.startAt ?? null,
    end_at: p.endAt ?? null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function mapCoupon(r: Record<string, unknown>): Coupon {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    code: String(r.code),
    discountType: String(r.discount_type) as Coupon["discountType"],
    discountValue: Number(r.discount_value),
    scope: String(r.scope) as Coupon["scope"],
    planIds: Array.isArray(r.plan_ids) ? (r.plan_ids as string[]) : [],
    startAt: r.start_at ? new Date(String(r.start_at)).toISOString() : undefined,
    endAt: r.end_at ? new Date(String(r.end_at)).toISOString() : undefined,
    maxRedemptions: r.max_redemptions == null ? undefined : Number(r.max_redemptions),
    perPatientOnce: Boolean(r.per_patient_once),
    newPatientsOnly: Boolean(r.new_patients_only),
    redemptions: Number(r.redemptions ?? 0),
    active: Boolean(r.active),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function couponToRow(c: Coupon) {
  return {
    id: c.id,
    doctor_id: c.doctorId,
    code: c.code,
    discount_type: c.discountType,
    discount_value: c.discountValue,
    scope: c.scope,
    plan_ids: c.planIds ?? [],
    start_at: c.startAt ?? null,
    end_at: c.endAt ?? null,
    max_redemptions: c.maxRedemptions ?? null,
    per_patient_once: c.perPatientOnce,
    new_patients_only: c.newPatientsOnly,
    redemptions: c.redemptions,
    active: c.active,
    created_at: c.createdAt,
  };
}

function mapEnrollment(r: Record<string, unknown>): PlanEnrollment {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    patientKey: String(r.patient_key),
    patientName: String(r.patient_name),
    planId: r.plan_id ? String(r.plan_id) : undefined,
    planName: String(r.plan_name),
    source: String(r.source) as PlanEnrollment["source"],
    previousEnrollmentId: r.previous_enrollment_id ? String(r.previous_enrollment_id) : undefined,
    durationLabel: String(r.duration_label),
    durationDays: Number(r.duration_days),
    startAt: r.start_at ? new Date(String(r.start_at)).toISOString() : undefined,
    endAt: r.end_at ? new Date(String(r.end_at)).toISOString() : undefined,
    consultationsTotal: Number(r.consultations_total),
    consultationsUsed: Number(r.consultations_used),
    status: String(r.status) as PlanEnrollment["status"],
    statusHistory: Array.isArray(r.status_history)
      ? (r.status_history as PlanEnrollment["statusHistory"])
      : [],
    pricing: (r.pricing ?? {}) as PricingSnapshot,
    paymentMethod: String(r.payment_method) as PlanEnrollment["paymentMethod"],
    paymentId: r.payment_id ? String(r.payment_id) : undefined,
    paidAt: r.paid_at ? new Date(String(r.paid_at)).toISOString() : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

function enrollmentToRow(e: PlanEnrollment) {
  return {
    id: e.id,
    doctor_id: e.doctorId,
    patient_key: e.patientKey,
    patient_name: e.patientName,
    plan_id: e.planId ?? null,
    plan_name: e.planName,
    source: e.source,
    previous_enrollment_id: e.previousEnrollmentId ?? null,
    duration_label: e.durationLabel,
    duration_days: e.durationDays,
    start_at: e.startAt ?? null,
    end_at: e.endAt ?? null,
    consultations_total: e.consultationsTotal,
    consultations_used: e.consultationsUsed,
    status: e.status,
    status_history: e.statusHistory,
    pricing: e.pricing,
    payment_method: e.paymentMethod,
    payment_id: e.paymentId ?? null,
    paid_at: e.paidAt ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function mapOffer(r: Record<string, unknown>): PatientOffer {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    patientKey: String(r.patient_key),
    patientName: String(r.patient_name),
    offerType: String(r.offer_type) as PatientOffer["offerType"],
    planName: String(r.plan_name),
    description: r.description ? String(r.description) : undefined,
    durationKind: r.duration_kind ? (String(r.duration_kind) as PatientOffer["durationKind"]) : undefined,
    customDays: r.custom_days == null ? undefined : Number(r.custom_days),
    consultations: r.consultations == null ? undefined : Number(r.consultations),
    originalPriceCents: Number(r.original_price_cents),
    discountType: r.discount_type ? (String(r.discount_type) as PatientOffer["discountType"]) : null,
    discountValue: r.discount_value == null ? null : Number(r.discount_value),
    finalPriceCents: Number(r.final_price_cents),
    validUntil: r.valid_until ? new Date(String(r.valid_until)).toISOString() : undefined,
    status: String(r.status) as PatientOffer["status"],
    enrollmentId: r.enrollment_id ? String(r.enrollment_id) : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

function offerToRow(o: PatientOffer) {
  return {
    id: o.id,
    doctor_id: o.doctorId,
    patient_key: o.patientKey,
    patient_name: o.patientName,
    offer_type: o.offerType,
    plan_name: o.planName,
    description: o.description ?? null,
    duration_kind: o.durationKind ?? null,
    custom_days: o.customDays ?? null,
    consultations: o.consultations ?? null,
    original_price_cents: o.originalPriceCents,
    discount_type: o.discountType ?? null,
    discount_value: o.discountValue ?? null,
    final_price_cents: o.finalPriceCents,
    valid_until: o.validUntil ?? null,
    status: o.status,
    enrollment_id: o.enrollmentId ?? null,
    created_at: o.createdAt,
  };
}

// ---------- PLANOS ----------

export async function listPlansByDoctor(doctorId: string): Promise<PlanTemplate[]> {
  const admin = sb("plan_templates");
  if (admin) {
    const { data, error } = await admin
      .from("plan_templates")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (!handleMissing("plan_templates", error) && !error) return (data ?? []).map(mapPlan);
  }
  const db = await readLocal();
  return db.planTemplates
    .filter((p) => p.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPublicPlans(doctorId: string): Promise<PlanTemplate[]> {
  const all = await listPlansByDoctor(doctorId);
  return all.filter((p) => p.status === "ativo" && p.availability === "publico");
}

export async function getPlan(id: string): Promise<PlanTemplate | null> {
  const admin = sb("plan_templates");
  if (admin) {
    const { data, error } = await admin.from("plan_templates").select("*").eq("id", id).maybeSingle();
    if (!handleMissing("plan_templates", error) && !error) return data ? mapPlan(data) : null;
  }
  const db = await readLocal();
  return db.planTemplates.find((p) => p.id === id) ?? null;
}

export async function createPlan(
  input: Omit<PlanTemplate, "id" | "createdAt" | "updatedAt">
): Promise<PlanTemplate> {
  const now = new Date().toISOString();
  const plan: PlanTemplate = { ...input, id: uuid(), createdAt: now, updatedAt: now };
  const admin = sb("plan_templates");
  if (admin) {
    const { error } = await admin.from("plan_templates").insert(planToRow(plan));
    if (!handleMissing("plan_templates", error)) {
      if (error) throw error;
      return plan;
    }
  }
  await mutateLocal((db) => db.planTemplates.push(plan));
  return plan;
}

export async function updatePlan(
  id: string,
  doctorId: string,
  patch: Partial<Omit<PlanTemplate, "id" | "doctorId" | "createdAt">>
): Promise<PlanTemplate | null> {
  const existing = await getPlan(id);
  if (!existing || existing.doctorId !== doctorId) return null;
  const updated: PlanTemplate = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const admin = sb("plan_templates");
  if (admin) {
    const { error } = await admin.from("plan_templates").update(planToRow(updated)).eq("id", id);
    if (!handleMissing("plan_templates", error)) {
      if (error) throw error;
      return updated;
    }
  }
  await mutateLocal((db) => {
    db.planTemplates = db.planTemplates.map((p) => (p.id === id ? updated : p));
  });
  return updated;
}

export async function deletePlan(id: string, doctorId: string): Promise<boolean> {
  const existing = await getPlan(id);
  if (!existing || existing.doctorId !== doctorId) return false;
  const admin = sb("plan_templates");
  if (admin) {
    const { error } = await admin.from("plan_templates").delete().eq("id", id).eq("doctor_id", doctorId);
    if (!handleMissing("plan_templates", error)) {
      if (error) throw error;
      return true;
    }
  }
  await mutateLocal((db) => {
    db.planTemplates = db.planTemplates.filter((p) => p.id !== id);
  });
  return true;
}

// ---------- PROMOÇÕES ----------

export async function listPromotionsByDoctor(doctorId: string): Promise<Promotion[]> {
  const admin = sb("promotions");
  if (admin) {
    const { data, error } = await admin
      .from("promotions")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (!handleMissing("promotions", error) && !error) return (data ?? []).map(mapPromotion);
  }
  const db = await readLocal();
  return db.promotions
    .filter((p) => p.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  const admin = sb("promotions");
  if (admin) {
    const { data, error } = await admin.from("promotions").select("*").eq("id", id).maybeSingle();
    if (!handleMissing("promotions", error) && !error) return data ? mapPromotion(data) : null;
  }
  const db = await readLocal();
  return db.promotions.find((p) => p.id === id) ?? null;
}

export async function createPromotion(
  input: Omit<Promotion, "id" | "createdAt" | "updatedAt">
): Promise<Promotion> {
  const now = new Date().toISOString();
  const promo: Promotion = { ...input, id: uuid(), createdAt: now, updatedAt: now };
  const admin = sb("promotions");
  if (admin) {
    const { error } = await admin.from("promotions").insert(promotionToRow(promo));
    if (!handleMissing("promotions", error)) {
      if (error) throw error;
      return promo;
    }
  }
  await mutateLocal((db) => db.promotions.push(promo));
  return promo;
}

export async function updatePromotion(
  id: string,
  doctorId: string,
  patch: Partial<Omit<Promotion, "id" | "doctorId" | "createdAt">>
): Promise<Promotion | null> {
  const existing = await getPromotion(id);
  if (!existing || existing.doctorId !== doctorId) return null;
  const updated: Promotion = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const admin = sb("promotions");
  if (admin) {
    const { error } = await admin.from("promotions").update(promotionToRow(updated)).eq("id", id);
    if (!handleMissing("promotions", error)) {
      if (error) throw error;
      return updated;
    }
  }
  await mutateLocal((db) => {
    db.promotions = db.promotions.map((p) => (p.id === id ? updated : p));
  });
  return updated;
}

export async function deletePromotion(id: string, doctorId: string): Promise<boolean> {
  const existing = await getPromotion(id);
  if (!existing || existing.doctorId !== doctorId) return false;
  const admin = sb("promotions");
  if (admin) {
    const { error } = await admin.from("promotions").delete().eq("id", id).eq("doctor_id", doctorId);
    if (!handleMissing("promotions", error)) {
      if (error) throw error;
      return true;
    }
  }
  await mutateLocal((db) => {
    db.promotions = db.promotions.filter((p) => p.id !== id);
  });
  return true;
}

// ---------- CUPONS ----------

export async function listCouponsByDoctor(doctorId: string): Promise<Coupon[]> {
  const admin = sb("coupons");
  if (admin) {
    const { data, error } = await admin
      .from("coupons")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (!handleMissing("coupons", error) && !error) return (data ?? []).map(mapCoupon);
  }
  const db = await readLocal();
  return db.coupons
    .filter((c) => c.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCouponByCode(doctorId: string, code: string): Promise<Coupon | null> {
  const upper = code.trim().toUpperCase();
  const list = await listCouponsByDoctor(doctorId);
  return list.find((c) => c.code.toUpperCase() === upper) ?? null;
}

export async function getCoupon(id: string): Promise<Coupon | null> {
  const admin = sb("coupons");
  if (admin) {
    const { data, error } = await admin.from("coupons").select("*").eq("id", id).maybeSingle();
    if (!handleMissing("coupons", error) && !error) return data ? mapCoupon(data) : null;
  }
  const db = await readLocal();
  return db.coupons.find((c) => c.id === id) ?? null;
}

export async function createCoupon(
  input: Omit<Coupon, "id" | "createdAt" | "redemptions">
): Promise<Coupon> {
  const coupon: Coupon = {
    ...input,
    code: input.code.trim().toUpperCase(),
    redemptions: 0,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const admin = sb("coupons");
  if (admin) {
    const { error } = await admin.from("coupons").insert(couponToRow(coupon));
    if (!handleMissing("coupons", error)) {
      if (error) throw error;
      return coupon;
    }
  }
  await mutateLocal((db) => db.coupons.push(coupon));
  return coupon;
}

export async function deleteCoupon(id: string, doctorId: string): Promise<boolean> {
  const existing = await getCoupon(id);
  if (!existing || existing.doctorId !== doctorId) return false;
  const admin = sb("coupons");
  if (admin) {
    const { error } = await admin.from("coupons").delete().eq("id", id).eq("doctor_id", doctorId);
    if (!handleMissing("coupons", error)) {
      if (error) throw error;
      return true;
    }
  }
  await mutateLocal((db) => {
    db.coupons = db.coupons.filter((c) => c.id !== id);
  });
  return true;
}

export async function countPatientRedemptions(couponId: string, patientKey: string): Promise<number> {
  const admin = sb("coupon_redemptions");
  if (admin) {
    const { count, error } = await admin
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", couponId)
      .eq("patient_key", patientKey);
    if (!handleMissing("coupon_redemptions", error) && !error) return count ?? 0;
  }
  const db = await readLocal();
  return db.couponRedemptions.filter((r) => r.couponId === couponId && r.patientKey === patientKey).length;
}

/**
 * Resgata um cupom com verificação de limite total (idempotência básica por
 * re-checagem). Retorna false se o limite total já foi atingido.
 */
export async function redeemCoupon(
  couponId: string,
  doctorId: string,
  patientKey: string,
  enrollmentId?: string
): Promise<boolean> {
  const coupon = await getCoupon(couponId);
  if (!coupon) return false;
  if (typeof coupon.maxRedemptions === "number" && coupon.redemptions >= coupon.maxRedemptions) {
    return false;
  }
  const admin = sb("coupons");
  if (admin) {
    const redemptionAdmin = sb("coupon_redemptions");
    if (redemptionAdmin) {
      await redemptionAdmin.from("coupon_redemptions").insert({
        id: uuid(),
        coupon_id: couponId,
        doctor_id: doctorId,
        patient_key: patientKey,
        enrollment_id: enrollmentId ?? null,
        created_at: new Date().toISOString(),
      });
    }
    // Incremento condicionado ao limite (evita ultrapassar em concorrência simples).
    const { data, error } = await admin
      .from("coupons")
      .update({ redemptions: coupon.redemptions + 1 })
      .eq("id", couponId)
      .eq("redemptions", coupon.redemptions)
      .select("id");
    if (!handleMissing("coupons", error)) {
      if (error) throw error;
      return Boolean(data && data.length > 0);
    }
  }
  return mutateLocal((db) => {
    const c = db.coupons.find((x) => x.id === couponId);
    if (!c) return false;
    if (typeof c.maxRedemptions === "number" && c.redemptions >= c.maxRedemptions) return false;
    c.redemptions += 1;
    db.couponRedemptions.push({
      id: uuid(),
      couponId,
      doctorId,
      patientKey,
      enrollmentId,
      createdAt: new Date().toISOString(),
    });
    return true;
  });
}

// ---------- CONTRATAÇÕES ----------

export async function createEnrollment(
  input: Omit<PlanEnrollment, "id" | "createdAt" | "updatedAt">
): Promise<PlanEnrollment> {
  const now = new Date().toISOString();
  const enrollment: PlanEnrollment = { ...input, id: uuid(), createdAt: now, updatedAt: now };
  const admin = sb("plan_enrollments");
  if (admin) {
    const { error } = await admin.from("plan_enrollments").insert(enrollmentToRow(enrollment));
    if (!handleMissing("plan_enrollments", error)) {
      if (error) throw error;
      return enrollment;
    }
  }
  await mutateLocal((db) => db.enrollments.push(enrollment));
  return enrollment;
}

export async function getEnrollment(id: string): Promise<PlanEnrollment | null> {
  const admin = sb("plan_enrollments");
  if (admin) {
    const { data, error } = await admin.from("plan_enrollments").select("*").eq("id", id).maybeSingle();
    if (!handleMissing("plan_enrollments", error) && !error) return data ? mapEnrollment(data) : null;
  }
  const db = await readLocal();
  return db.enrollments.find((e) => e.id === id) ?? null;
}

export async function updateEnrollment(
  id: string,
  patch: Partial<PlanEnrollment>
): Promise<PlanEnrollment | null> {
  const existing = await getEnrollment(id);
  if (!existing) return null;
  const updated: PlanEnrollment = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const admin = sb("plan_enrollments");
  if (admin) {
    const { error } = await admin.from("plan_enrollments").update(enrollmentToRow(updated)).eq("id", id);
    if (!handleMissing("plan_enrollments", error)) {
      if (error) throw error;
      return updated;
    }
  }
  await mutateLocal((db) => {
    db.enrollments = db.enrollments.map((e) => (e.id === id ? updated : e));
  });
  return updated;
}

export async function listEnrollmentsByPatient(patientKey: string): Promise<PlanEnrollment[]> {
  const admin = sb("plan_enrollments");
  if (admin) {
    const { data, error } = await admin
      .from("plan_enrollments")
      .select("*")
      .eq("patient_key", patientKey)
      .order("created_at", { ascending: false });
    if (!handleMissing("plan_enrollments", error) && !error) return (data ?? []).map(mapEnrollment);
  }
  const db = await readLocal();
  return db.enrollments
    .filter((e) => e.patientKey === patientKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listEnrollmentsByDoctor(doctorId: string): Promise<PlanEnrollment[]> {
  const admin = sb("plan_enrollments");
  if (admin) {
    const { data, error } = await admin
      .from("plan_enrollments")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (!handleMissing("plan_enrollments", error) && !error) return (data ?? []).map(mapEnrollment);
  }
  const db = await readLocal();
  return db.enrollments
    .filter((e) => e.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAllEnrollments(): Promise<PlanEnrollment[]> {
  const admin = sb("plan_enrollments");
  if (admin) {
    const { data, error } = await admin
      .from("plan_enrollments")
      .select("*")
      .order("created_at", { ascending: false });
    if (!handleMissing("plan_enrollments", error) && !error) return (data ?? []).map(mapEnrollment);
  }
  const db = await readLocal();
  return db.enrollments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- OFERTAS ----------

export async function createOffer(
  input: Omit<PatientOffer, "id" | "createdAt">
): Promise<PatientOffer> {
  const offer: PatientOffer = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  const admin = sb("patient_offers");
  if (admin) {
    const { error } = await admin.from("patient_offers").insert(offerToRow(offer));
    if (!handleMissing("patient_offers", error)) {
      if (error) throw error;
      return offer;
    }
  }
  await mutateLocal((db) => db.offers.push(offer));
  return offer;
}

export async function getOffer(id: string): Promise<PatientOffer | null> {
  const admin = sb("patient_offers");
  if (admin) {
    const { data, error } = await admin.from("patient_offers").select("*").eq("id", id).maybeSingle();
    if (!handleMissing("patient_offers", error) && !error) return data ? mapOffer(data) : null;
  }
  const db = await readLocal();
  return db.offers.find((o) => o.id === id) ?? null;
}

export async function updateOffer(id: string, patch: Partial<PatientOffer>): Promise<PatientOffer | null> {
  const existing = await getOffer(id);
  if (!existing) return null;
  const updated: PatientOffer = { ...existing, ...patch };
  const admin = sb("patient_offers");
  if (admin) {
    const { error } = await admin.from("patient_offers").update(offerToRow(updated)).eq("id", id);
    if (!handleMissing("patient_offers", error)) {
      if (error) throw error;
      return updated;
    }
  }
  await mutateLocal((db) => {
    db.offers = db.offers.map((o) => (o.id === id ? updated : o));
  });
  return updated;
}

export async function listOffersByPatient(patientKey: string): Promise<PatientOffer[]> {
  const admin = sb("patient_offers");
  if (admin) {
    const { data, error } = await admin
      .from("patient_offers")
      .select("*")
      .eq("patient_key", patientKey)
      .order("created_at", { ascending: false });
    if (!handleMissing("patient_offers", error) && !error) return (data ?? []).map(mapOffer);
  }
  const db = await readLocal();
  return db.offers
    .filter((o) => o.patientKey === patientKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOffersByDoctor(doctorId: string): Promise<PatientOffer[]> {
  const admin = sb("patient_offers");
  if (admin) {
    const { data, error } = await admin
      .from("patient_offers")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (!handleMissing("patient_offers", error) && !error) return (data ?? []).map(mapOffer);
  }
  const db = await readLocal();
  return db.offers
    .filter((o) => o.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- AUDITORIA ----------

export async function logPlansAudit(input: Omit<PlansAudit, "id" | "createdAt">): Promise<void> {
  const event: PlansAudit = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  const admin = sb("plans_audit");
  if (admin) {
    const { error } = await admin.from("plans_audit").insert({
      id: event.id,
      actor: event.actor,
      actor_id: event.actorId ?? null,
      doctor_id: event.doctorId ?? null,
      action: event.action,
      entity: event.entity ?? null,
      entity_id: event.entityId ?? null,
      detail: event.detail ?? {},
      created_at: event.createdAt,
    });
    if (!handleMissing("plans_audit", error)) {
      if (error) throw error;
      return;
    }
  }
  await mutateLocal((db) => db.audit.push(event));
}
