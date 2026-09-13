import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { listMembershipsForActor } from "./platform-store";
import type {
  ClinicEncounter,
  ClinicFeeRule,
  ClinicPayment,
  ClinicPaymentMethod,
  EncounterPaymentStatus,
} from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-finance.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { rules: ClinicFeeRule[]; encounters: ClinicEncounter[]; payments: ClinicPayment[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { rules: [], encounters: [], payments: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapRule(r: Record<string, unknown>): ClinicFeeRule {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    feeCents: Number(r.fee_cents ?? r.feeCents ?? 0),
    clinicSharePercent: Number(r.clinic_share_percent ?? r.clinicSharePercent ?? 0),
    active: r.active !== false,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapEncounter(r: Record<string, unknown>): ClinicEncounter {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    bookingId: (r.booking_id as string) ?? (r.bookingId as string) ?? null,
    feeCents: Number(r.fee_cents ?? r.feeCents ?? 0),
    clinicShareCents: Number(r.clinic_share_cents ?? r.clinicShareCents ?? 0),
    doctorShareCents: Number(r.doctor_share_cents ?? r.doctorShareCents ?? 0),
    receivedCents: Number(r.received_cents ?? r.receivedCents ?? 0),
    paymentStatus: String(r.payment_status ?? r.paymentStatus ?? "pending") as EncounterPaymentStatus,
    attendedAt: String(r.attended_at ?? r.attendedAt),
    createdAt: String(r.created_at ?? r.createdAt),
  };
}
function mapPayment(r: Record<string, unknown>): ClinicPayment {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    encounterId: String(r.encounter_id ?? r.encounterId),
    method: String(r.method) as ClinicPaymentMethod,
    amountCents: Number(r.amount_cents ?? r.amountCents ?? 0),
    discountCents: Number(r.discount_cents ?? r.discountCents ?? 0),
    status: String(r.status ?? "paid") as EncounterPaymentStatus,
    note: (r.note as string) ?? null,
    recordedByKind: (r.recorded_by_kind as string) ?? (r.recordedByKind as string) ?? null,
    recordedById: (r.recorded_by_id as string) ?? (r.recordedById as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}

export async function listFeeRules(clinicId: string): Promise<ClinicFeeRule[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_fee_rules").select("*").eq("clinic_id", clinicId).eq("active", true);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapRule(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).rules.filter((r) => r.clinicId === clinicId && r.active);
}

export async function getFeeRule(clinicId: string, doctorId: string): Promise<ClinicFeeRule | null> {
  const rules = await listFeeRules(clinicId);
  return rules.find((r) => r.doctorId === doctorId) ?? null;
}

export async function upsertFeeRule(input: {
  clinicId: string;
  doctorId: string;
  feeCents: number;
  clinicSharePercent: number;
}): Promise<ClinicFeeRule> {
  const now = new Date().toISOString();
  const existing = await getFeeRule(input.clinicId, input.doctorId);
  const row: ClinicFeeRule = existing
    ? { ...existing, feeCents: input.feeCents, clinicSharePercent: input.clinicSharePercent, updatedAt: now }
    : {
        id: uuid(),
        clinicId: input.clinicId,
        doctorId: input.doctorId,
        feeCents: input.feeCents,
        clinicSharePercent: input.clinicSharePercent,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const payload = {
      id: row.id,
      clinic_id: row.clinicId,
      doctor_id: row.doctorId,
      fee_cents: row.feeCents,
      clinic_share_percent: row.clinicSharePercent,
      active: true,
      created_at: row.createdAt,
      updated_at: now,
    };
    const { error } = existing
      ? await sb.from("clinic_fee_rules").update(payload).eq("id", row.id)
      : await sb.from("clinic_fee_rules").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  const idx = local.rules.findIndex((r) => r.id === row.id);
  if (idx >= 0) local.rules[idx] = row;
  else local.rules.push(row);
  await writeLocal(local);
  return row;
}

export async function listEncounters(clinicId: string, from?: string, to?: string): Promise<ClinicEncounter[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    let q = sb.from("clinic_encounters").select("*").eq("clinic_id", clinicId).order("attended_at", { ascending: false });
    if (from) q = q.gte("attended_at", from);
    if (to) q = q.lte("attended_at", to);
    const { data, error } = await q;
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapEncounter(r as Record<string, unknown>));
    }
  }
  let rows = (await readLocal()).encounters.filter((e) => e.clinicId === clinicId);
  if (from) rows = rows.filter((e) => e.attendedAt >= from);
  if (to) rows = rows.filter((e) => e.attendedAt <= to);
  return rows.sort((a, b) => b.attendedAt.localeCompare(a.attendedAt));
}

export async function getEncounter(id: string): Promise<ClinicEncounter | null> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_encounters").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapEncounter(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).encounters.find((e) => e.id === id) ?? null;
}

async function findDuplicate(clinicId: string, doctorId: string, patientKey: string, day: string): Promise<ClinicEncounter | null> {
  const rows = await listEncounters(clinicId);
  return rows.find((e) => e.doctorId === doctorId && e.patientKey === patientKey && e.attendedAt.slice(0, 10) === day) ?? null;
}

export async function createEncounter(input: {
  clinicId: string;
  doctorId: string;
  patientKey: string;
  patientName?: string | null;
  bookingId?: string | null;
}): Promise<ClinicEncounter> {
  const day = new Date().toISOString().slice(0, 10);
  const dup = await findDuplicate(input.clinicId, input.doctorId, input.patientKey.toLowerCase().trim(), day);
  if (dup) return dup;
  const rule = await getFeeRule(input.clinicId, input.doctorId);
  const feeCents = rule?.feeCents ?? 0;
  const clinicShare = Math.round((feeCents * (rule?.clinicSharePercent ?? 0)) / 100);
  const now = new Date().toISOString();
  const row: ClinicEncounter = {
    id: uuid(),
    clinicId: input.clinicId,
    doctorId: input.doctorId,
    patientKey: input.patientKey.toLowerCase().trim(),
    patientName: input.patientName ?? null,
    bookingId: input.bookingId ?? null,
    feeCents,
    clinicShareCents: clinicShare,
    doctorShareCents: feeCents - clinicShare,
    receivedCents: 0,
    paymentStatus: "pending",
    attendedAt: now,
    createdAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_encounters").insert({
      id: row.id,
      clinic_id: row.clinicId,
      doctor_id: row.doctorId,
      patient_key: row.patientKey,
      patient_name: row.patientName,
      booking_id: row.bookingId,
      fee_cents: row.feeCents,
      clinic_share_cents: row.clinicShareCents,
      doctor_share_cents: row.doctorShareCents,
      received_cents: 0,
      payment_status: "pending",
      attended_at: now,
      created_at: now,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.encounters.unshift(row);
  await writeLocal(local);
  return row;
}

/**
 * Cria produção só se o médico tiver exatamente uma clínica ativa.
 * Não adivinha clínica quando há várias. Não quebra o fluxo médico.
 */
export async function recordProductionFromAttendance(input: {
  doctorId: string;
  patientKey: string;
  bookingId?: string | null;
  patientName?: string | null;
}): Promise<ClinicEncounter | null> {
  const memberships = (await listMembershipsForActor("doctor", input.doctorId)).filter(
    (m) => m.role === "MEDICO" || m.role === "ADMIN_CLINICA"
  );
  const clinicIds = Array.from(new Set(memberships.map((m) => m.clinicId)));
  if (clinicIds.length !== 1) return null;
  return createEncounter({
    clinicId: clinicIds[0],
    doctorId: input.doctorId,
    patientKey: input.patientKey,
    bookingId: input.bookingId,
    patientName: input.patientName,
  });
}

async function saveEncounter(row: ClinicEncounter): Promise<void> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from("clinic_encounters")
      .update({
        received_cents: row.receivedCents,
        payment_status: row.paymentStatus,
      })
      .eq("id", row.id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.encounters.findIndex((e) => e.id === row.id);
  if (idx >= 0) local.encounters[idx] = row;
  await writeLocal(local);
}

export async function recordCheckIn(input: {
  clinicId: string;
  encounterId: string;
  method: ClinicPaymentMethod;
  amountCents: number;
  discountCents?: number;
  note?: string;
  recordedByKind?: string;
  recordedById?: string;
}): Promise<{ encounter: ClinicEncounter; payment: ClinicPayment }> {
  const encounter = await getEncounter(input.encounterId);
  if (!encounter || encounter.clinicId !== input.clinicId) throw new Error("Atendimento não encontrado nesta clínica.");
  const courtesy = input.method === "courtesy";
  const amount = courtesy ? 0 : Math.max(0, Math.round(input.amountCents));
  const discount = Math.max(0, Math.round(input.discountCents || 0));
  const received = encounter.receivedCents + amount;
  let paymentStatus: EncounterPaymentStatus = encounter.paymentStatus;
  if (courtesy && received === 0) paymentStatus = "courtesy";
  else if (received <= 0) paymentStatus = "pending";
  else if (received >= encounter.feeCents - discount) paymentStatus = "paid";
  else paymentStatus = "partial";

  const payment: ClinicPayment = {
    id: uuid(),
    clinicId: input.clinicId,
    encounterId: encounter.id,
    method: input.method,
    amountCents: amount,
    discountCents: discount,
    status: courtesy ? "courtesy" : paymentStatus,
    note: input.note?.trim() || null,
    recordedByKind: input.recordedByKind ?? null,
    recordedById: input.recordedById ?? null,
    createdAt: new Date().toISOString(),
  };
  const next: ClinicEncounter = { ...encounter, receivedCents: received, paymentStatus };

  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_payments").insert({
      id: payment.id,
      clinic_id: payment.clinicId,
      encounter_id: payment.encounterId,
      method: payment.method,
      amount_cents: payment.amountCents,
      discount_cents: payment.discountCents,
      status: payment.status,
      note: payment.note,
      recorded_by_kind: payment.recordedByKind,
      recorded_by_id: payment.recordedById,
      created_at: payment.createdAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await saveEncounter(next);
      return { encounter: next, payment };
    }
  }
  const local = await readLocal();
  local.payments.unshift(payment);
  const idx = local.encounters.findIndex((e) => e.id === next.id);
  if (idx >= 0) local.encounters[idx] = next;
  await writeLocal(local);
  return { encounter: next, payment };
}

export function productionSummary(encounters: ClinicEncounter[]) {
  const byDoctor = new Map<string, { doctorId: string; count: number; producedCents: number; receivedCents: number }>();
  for (const e of encounters) {
    const cur = byDoctor.get(e.doctorId) || { doctorId: e.doctorId, count: 0, producedCents: 0, receivedCents: 0 };
    cur.count += 1;
    cur.producedCents += e.feeCents;
    cur.receivedCents += e.receivedCents;
    byDoctor.set(e.doctorId, cur);
  }
  return {
    count: encounters.length,
    producedCents: encounters.reduce((s, e) => s + e.feeCents, 0),
    receivedCents: encounters.reduce((s, e) => s + e.receivedCents, 0),
    pendingCents: encounters.reduce((s, e) => s + Math.max(0, e.feeCents - e.receivedCents), 0),
    byDoctor: Array.from(byDoctor.values()),
  };
}
