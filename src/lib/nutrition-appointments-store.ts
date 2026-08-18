import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type NutritionAppointmentStatus = "aguardando_pagamento" | "aguardando_confirmacao" | "confirmada" | "cancelada" | "realizada";

export interface NutritionAppointment {
  id: string;
  nutritionistId: string;
  nutritionistName?: string | null;
  doctorId?: string | null;
  patientKey: string;
  patientName?: string | null;
  slotStart?: string | null;
  modality: "teleconsulta" | "presencial";
  priceCents: number;
  status: NutritionAppointmentStatus;
  paymentMethod: string;
  pixCopiaCola?: string | null;
  proofUrl?: string | null;
  commissionPercent?: number | null;
  platformFeeCents?: number | null;
  nutritionistPayoutCents?: number | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "nutrition-appointments.json");
let tableMissing = false;
function activeDb() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
async function readLocal(): Promise<NutritionAppointment[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as NutritionAppointment[]; } catch { return []; }
}
async function writeLocal(list: NutritionAppointment[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
function map(r: Record<string, unknown>): NutritionAppointment {
  return {
    id: String(r.id), nutritionistId: String(r.nutritionist_id), nutritionistName: (r.nutritionist_name as string) ?? null,
    doctorId: (r.doctor_id as string) ?? null, patientKey: String(r.patient_key), patientName: (r.patient_name as string) ?? null,
    slotStart: (r.slot_start as string) ?? null, modality: (r.modality as "teleconsulta" | "presencial") ?? "teleconsulta",
    priceCents: Number(r.price_cents ?? 0), status: (r.status as NutritionAppointmentStatus) ?? "aguardando_pagamento",
    paymentMethod: (r.payment_method as string) ?? "pix_direto", pixCopiaCola: (r.pix_copia_cola as string) ?? null,
    proofUrl: (r.proof_url as string) ?? null,
    commissionPercent: r.commission_percent != null ? Number(r.commission_percent) : null,
    platformFeeCents: r.platform_fee_cents != null ? Number(r.platform_fee_cents) : null,
    nutritionistPayoutCents: r.nutritionist_payout_cents != null ? Number(r.nutritionist_payout_cents) : null,
    note: (r.note as string) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()), updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}
function toRow(a: NutritionAppointment): Record<string, unknown> {
  return {
    id: a.id, nutritionist_id: a.nutritionistId, nutritionist_name: a.nutritionistName, doctor_id: a.doctorId,
    patient_key: a.patientKey, patient_name: a.patientName, slot_start: a.slotStart, modality: a.modality,
    price_cents: a.priceCents, status: a.status, payment_method: a.paymentMethod, pix_copia_cola: a.pixCopiaCola,
    proof_url: a.proofUrl, commission_percent: a.commissionPercent, platform_fee_cents: a.platformFeeCents,
    nutritionist_payout_cents: a.nutritionistPayoutCents, note: a.note, created_at: a.createdAt, updated_at: a.updatedAt,
  };
}

export async function createAppointment(input: Omit<NutritionAppointment, "id" | "createdAt" | "updatedAt">): Promise<NutritionAppointment> {
  const now = new Date().toISOString();
  const a: NutritionAppointment = { id: uuid(), createdAt: now, updatedAt: now, ...input };
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_appointments").insert(toRow(a));
    if (!isMissing(error)) { if (error) throw error; return a; }
    tableMissing = true;
  }
  const list = await readLocal(); list.push(a); await writeLocal(list);
  return a;
}

export async function getAppointment(id: string): Promise<NutritionAppointment | null> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_appointments").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? map(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal(); return list.find((a) => a.id === id) ?? null;
}

export async function listAppointmentsForNutritionist(nutritionistId: string): Promise<NutritionAppointment[]> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_appointments").select("*").eq("nutritionist_id", nutritionistId).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(map);
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal(); return list.filter((a) => a.nutritionistId === nutritionistId).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

export async function listAppointmentsForPatient(patientKey: string): Promise<NutritionAppointment[]> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_appointments").select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(map);
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal(); return list.filter((a) => a.patientKey === patientKey).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

export async function updateAppointment(id: string, patch: Partial<Pick<NutritionAppointment, "status" | "proofUrl" | "slotStart" | "note">>): Promise<NutritionAppointment | null> {
  const now = new Date().toISOString();
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const row: Record<string, unknown> = { updated_at: now };
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.proofUrl !== undefined) row.proof_url = patch.proofUrl;
    if (patch.slotStart !== undefined) row.slot_start = patch.slotStart;
    if (patch.note !== undefined) row.note = patch.note;
    const { error } = await s.from("nutrition_appointments").update(row).eq("id", id);
    if (!isMissing(error)) { if (error) throw error; return await getAppointment(id); }
    tableMissing = true;
  }
  const list = await readLocal();
  const a = list.find((x) => x.id === id);
  if (!a) return null;
  Object.assign(a, patch, { updatedAt: now });
  await writeLocal(list);
  return a;
}
