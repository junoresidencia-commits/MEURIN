import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type MedicationSource = "patient" | "doctor";
export type MedicationStatus = "active" | "suspended";
export type DoseStatus = "taken" | "missed";

export interface Medication {
  id: string;
  patientKey: string;
  doctorId: string | null;
  name: string;
  dose: string | null;
  quantity: string | null;
  frequency: string | null;
  times: string[];
  guidance: string | null;
  notes: string | null;
  source: MedicationSource;
  confirmedByDoctor: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  status: MedicationStatus;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspendReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdherenceLog {
  id: string;
  medicationId: string;
  patientKey: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: DoseStatus;
  reason: string | null;
  reasonText: string | null;
  recordedAt: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "medications.json");
let tableMissing = false;
function activeDb() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
type LocalDb = { medications: Medication[]; logs: AdherenceLog[] };
async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; } catch { return { medications: [], logs: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapMed(r: Record<string, unknown>): Medication {
  return {
    id: String(r.id),
    patientKey: String(r.patient_key),
    doctorId: (r.doctor_id as string) ?? null,
    name: String(r.name),
    dose: (r.dose as string) ?? null,
    quantity: (r.quantity as string) ?? null,
    frequency: (r.frequency as string) ?? null,
    times: Array.isArray(r.times) ? (r.times as string[]) : [],
    guidance: (r.guidance as string) ?? null,
    notes: (r.notes as string) ?? null,
    source: (r.source as MedicationSource) ?? "patient",
    confirmedByDoctor: r.confirmed_by_doctor === true,
    confirmedAt: (r.confirmed_at as string) ?? null,
    confirmedBy: (r.confirmed_by as string) ?? null,
    status: (r.status as MedicationStatus) ?? "active",
    suspendedAt: (r.suspended_at as string) ?? null,
    suspendedBy: (r.suspended_by as string) ?? null,
    suspendReason: (r.suspend_reason as string) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}
function medToRow(m: Medication): Record<string, unknown> {
  return {
    id: m.id, patient_key: m.patientKey, doctor_id: m.doctorId, name: m.name, dose: m.dose,
    quantity: m.quantity, frequency: m.frequency, times: m.times, guidance: m.guidance, notes: m.notes,
    source: m.source, confirmed_by_doctor: m.confirmedByDoctor, confirmed_at: m.confirmedAt, confirmed_by: m.confirmedBy,
    status: m.status, suspended_at: m.suspendedAt, suspended_by: m.suspendedBy, suspend_reason: m.suspendReason,
    created_at: m.createdAt, updated_at: m.updatedAt,
  };
}
function mapLog(r: Record<string, unknown>): AdherenceLog {
  return {
    id: String(r.id), medicationId: String(r.medication_id), patientKey: String(r.patient_key),
    date: String(r.dose_date), time: String(r.dose_time), status: (r.status as DoseStatus) ?? "taken",
    reason: (r.reason as string) ?? null, reasonText: (r.reason_text as string) ?? null,
    recordedAt: String(r.recorded_at ?? new Date().toISOString()), createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

// ---------- Medications ----------
export async function addMedication(input: Omit<Medication, "id" | "createdAt" | "updatedAt">): Promise<Medication> {
  const now = new Date().toISOString();
  const m: Medication = { id: uuid(), createdAt: now, updatedAt: now, ...input };
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("patient_medications").insert(medToRow(m));
    if (!isMissing(error)) { if (error) throw error; return m; }
    tableMissing = true;
  }
  const db = await readLocal(); db.medications.push(m); await writeLocal(db);
  return m;
}

export async function getMedication(id: string): Promise<Medication | null> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_medications").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapMed(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal(); return db.medications.find((m) => m.id === id) ?? null;
}

export async function listMedications(patientKey: string, opts?: { includeSuspended?: boolean }): Promise<Medication[]> {
  const includeSuspended = opts?.includeSuspended ?? true;
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_medications").select("*").eq("patient_key", patientKey).order("created_at", { ascending: true });
    if (!isMissing(error) && !error) {
      const all = (data ?? []).map(mapMed);
      return includeSuspended ? all : all.filter((m) => m.status === "active");
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  const all = db.medications.filter((m) => m.patientKey === patientKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return includeSuspended ? all : all.filter((m) => m.status === "active");
}

export type MedicationPatch = Partial<Pick<Medication,
  "name" | "dose" | "quantity" | "frequency" | "times" | "guidance" | "notes" |
  "confirmedByDoctor" | "confirmedAt" | "confirmedBy" | "status" | "suspendedAt" | "suspendedBy" | "suspendReason" | "doctorId"
>>;

export async function updateMedication(id: string, patch: MedicationPatch): Promise<Medication | null> {
  const now = new Date().toISOString();
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const row: Record<string, unknown> = { updated_at: now };
    const m: Record<keyof MedicationPatch, string> = {
      name: "name", dose: "dose", quantity: "quantity", frequency: "frequency", times: "times", guidance: "guidance",
      notes: "notes", confirmedByDoctor: "confirmed_by_doctor", confirmedAt: "confirmed_at", confirmedBy: "confirmed_by",
      status: "status", suspendedAt: "suspended_at", suspendedBy: "suspended_by", suspendReason: "suspend_reason", doctorId: "doctor_id",
    };
    (Object.keys(patch) as (keyof MedicationPatch)[]).forEach((k) => { row[m[k]] = patch[k] as unknown; });
    const { error } = await s.from("patient_medications").update(row).eq("id", id);
    if (!isMissing(error)) { if (error) throw error; return await getMedication(id); }
    tableMissing = true;
  }
  const db = await readLocal();
  const med = db.medications.find((x) => x.id === id);
  if (!med) return null;
  Object.assign(med, patch, { updatedAt: now });
  await writeLocal(db);
  return med;
}

// ---------- Adherence log ----------
export async function listAdherence(patientKey: string, opts?: { from?: string; to?: string; medicationId?: string }): Promise<AdherenceLog[]> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("medication_adherence_log").select("*").eq("patient_key", patientKey);
    if (opts?.from) q = q.gte("dose_date", opts.from);
    if (opts?.to) q = q.lte("dose_date", opts.to);
    if (opts?.medicationId) q = q.eq("medication_id", opts.medicationId);
    const { data, error } = await q;
    if (!isMissing(error) && !error) return (data ?? []).map(mapLog);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.logs.filter((l) =>
    l.patientKey === patientKey &&
    (!opts?.from || l.date >= opts.from) &&
    (!opts?.to || l.date <= opts.to) &&
    (!opts?.medicationId || l.medicationId === opts.medicationId)
  );
}

/** Registra (ou atualiza) o status de uma dose específica (medicamento+data+horário). */
export async function setAdherence(input: {
  medicationId: string; patientKey: string; date: string; time: string;
  status: DoseStatus; reason?: string | null; reasonText?: string | null;
}): Promise<AdherenceLog> {
  const now = new Date().toISOString();
  const entry: AdherenceLog = {
    id: uuid(), medicationId: input.medicationId, patientKey: input.patientKey, date: input.date, time: input.time,
    status: input.status, reason: input.reason ?? null, reasonText: input.reasonText ?? null, recordedAt: now, createdAt: now,
  };
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("medication_adherence_log").upsert({
      medication_id: entry.medicationId, patient_key: entry.patientKey, dose_date: entry.date, dose_time: entry.time,
      status: entry.status, reason: entry.reason, reason_text: entry.reasonText, recorded_at: now,
    }, { onConflict: "medication_id,dose_date,dose_time" });
    if (!isMissing(error)) { if (error) throw error; return entry; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.logs.findIndex((l) => l.medicationId === entry.medicationId && l.date === entry.date && l.time === entry.time);
  if (idx >= 0) db.logs[idx] = { ...db.logs[idx], status: entry.status, reason: entry.reason, reasonText: entry.reasonText, recordedAt: now };
  else db.logs.push(entry);
  await writeLocal(db);
  return entry;
}
