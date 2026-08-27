import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "peritoneal-dialysis.json");
let tableMissing = false;
function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

export type PdModality = "CAPD" | "APD";

export interface PdProfile {
  patientKey: string;
  modality: PdModality | null;
  startDate?: string | null;
  implantDate?: string | null;
  catheterType?: string | null;
  catheterSite?: string | null;
  caregiver?: string | null;
  center?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface PdPrescription {
  id: string;
  patientKey: string;
  exchanges?: number | null;
  volumeMl?: number | null;
  dwellHours?: number | null;
  solution?: string | null;
  glucosePercent?: string | null;
  icodextrin?: boolean;
  totalDailyMl?: number | null;
  lastFill?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy: string;
  createdByName?: string | null;
}

export interface PdDailyLog {
  id: string;
  patientKey: string;
  loggedAt: string;
  weightKg?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  urineMl?: number | null;
  ultrafiltrationMl?: number | null;
  drainedMl?: number | null;
  balanceMl?: number | null;
  edema?: string | null;
  glucoseMgDl?: number | null;
  effluent?: string | null;
  abdominalPain?: boolean;
  fever?: boolean;
  missedExchanges?: boolean;
  events?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
}

export interface PdCatheterEval {
  id: string;
  patientKey: string;
  evaluatedAt: string;
  site?: string | null;
  orifice?: string | null;
  hyperemia?: boolean;
  secretion?: boolean;
  pain?: boolean;
  crust?: boolean;
  dressing?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
}

export interface PdPeritonitis {
  id: string;
  patientKey: string;
  onsetDate: string;
  symptoms?: string | null;
  cloudyEffluent?: boolean;
  abdominalPain?: boolean;
  cellCount?: string | null;
  pmn?: string | null;
  gram?: string | null;
  culture?: string | null;
  organism?: string | null;
  antibiotic?: string | null;
  route?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  clinicalResponse?: string | null;
  catheterRemoved?: boolean;
  recurrenceKind?: string | null;
  outcome?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
}

export interface PdAdequacy {
  id: string;
  patientKey: string;
  measuredAt: string;
  ktv?: number | null;
  residualClearance?: number | null;
  residualUrineMl?: number | null;
  ultrafiltrationMl?: number | null;
  pet?: string | null;
  transporter?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
}

export type PdTrainingStatus = "treinado" | "reforco" | "pendente";
export interface PdTraining {
  id: string;
  patientKey: string;
  evaluatedAt: string;
  items: Record<string, PdTrainingStatus>;
  notes?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
}

export const PD_TRAINING_ITEMS: { key: string; label: string }[] = [
  { key: "maos", label: "Higienização das mãos" },
  { key: "assepsia", label: "Técnica asséptica" },
  { key: "conexao", label: "Conexão/desconexão" },
  { key: "troca", label: "Troca da bolsa" },
  { key: "armazenamento", label: "Armazenamento" },
  { key: "efluente", label: "Reconhecimento de efluente turvo" },
  { key: "orificio", label: "Reconhecimento de infecção do orifício" },
  { key: "cateter", label: "Cuidados com cateter" },
  { key: "peso", label: "Controle de peso" },
  { key: "pa", label: "Controle de PA" },
  { key: "uf", label: "Registro de ultrafiltração" },
  { key: "quando", label: "Quando procurar atendimento" },
  { key: "intercorrencia", label: "Conduta em intercorrências" },
];

type LocalDb = {
  profiles: PdProfile[];
  prescriptions: PdPrescription[];
  logs: PdDailyLog[];
  catheter: PdCatheterEval[];
  peritonitis: PdPeritonitis[];
  adequacy: PdAdequacy[];
  training: PdTraining[];
};

async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; }
  catch {
    return { profiles: [], prescriptions: [], logs: [], catheter: [], peritonitis: [], adequacy: [], training: [] };
  }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function getPdProfile(patientKey: string): Promise<PdProfile | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("pd_profiles").select("*").eq("patient_key", patientKey).maybeSingle();
    if (!isMissing(error) && !error) {
      return data ? {
        patientKey, modality: (data.modality as PdModality) ?? null, startDate: data.start_date, implantDate: data.implant_date,
        catheterType: data.catheter_type, catheterSite: data.catheter_site, caregiver: data.caregiver, center: data.center,
        updatedAt: data.updated_at, updatedBy: data.updated_by,
      } : null;
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.profiles.find((p) => p.patientKey === patientKey) ?? null;
}

export async function upsertPdProfile(patientKey: string, patch: Partial<PdProfile>, by: string): Promise<PdProfile> {
  const cur = (await getPdProfile(patientKey)) || { patientKey, modality: null, updatedAt: new Date().toISOString() };
  const next: PdProfile = { ...cur, ...patch, patientKey, updatedAt: new Date().toISOString(), updatedBy: by };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("pd_profiles").upsert({
      patient_key: patientKey, modality: next.modality, start_date: next.startDate, implant_date: next.implantDate,
      catheter_type: next.catheterType, catheter_site: next.catheterSite, caregiver: next.caregiver, center: next.center,
      updated_at: next.updatedAt, updated_by: by,
    }, { onConflict: "patient_key" });
    if (!isMissing(error)) { if (error) throw error; return next; }
    tableMissing = true;
  }
  const db = await readLocal();
  const i = db.profiles.findIndex((p) => p.patientKey === patientKey);
  if (i >= 0) db.profiles[i] = next; else db.profiles.push(next);
  await writeLocal(db);
  return next;
}

async function insertRow<T extends { id: string }>(table: string, payload: Record<string, unknown>, localKey: keyof LocalDb, row: T): Promise<T> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from(table).insert(payload);
    if (!isMissing(error)) { if (error) throw error; return row; }
    tableMissing = true;
  }
  const db = await readLocal();
  (db[localKey] as unknown as T[]).push(row);
  await writeLocal(db);
  return row;
}

export async function addPdPrescription(input: Omit<PdPrescription, "id" | "createdAt">): Promise<PdPrescription> {
  const row: PdPrescription = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_prescriptions", {
    id: row.id, patient_key: row.patientKey, exchanges: row.exchanges, volume_ml: row.volumeMl, dwell_hours: row.dwellHours,
    solution: row.solution, glucose_percent: row.glucosePercent, icodextrin: row.icodextrin, total_daily_ml: row.totalDailyMl,
    last_fill: row.lastFill, notes: row.notes, created_at: row.createdAt, created_by: row.createdBy, created_by_name: row.createdByName,
  }, "prescriptions", row);
}

export async function addPdDailyLog(input: Omit<PdDailyLog, "id" | "createdAt">): Promise<PdDailyLog> {
  const row: PdDailyLog = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_daily_logs", {
    id: row.id, patient_key: row.patientKey, logged_at: row.loggedAt, weight_kg: row.weightKg, systolic: row.systolic,
    diastolic: row.diastolic, urine_ml: row.urineMl, ultrafiltration_ml: row.ultrafiltrationMl, drained_ml: row.drainedMl,
    balance_ml: row.balanceMl, edema: row.edema, glucose_mg_dl: row.glucoseMgDl, effluent: row.effluent,
    abdominal_pain: row.abdominalPain, fever: row.fever, missed_exchanges: row.missedExchanges, events: row.events,
    created_by: row.createdBy, created_by_name: row.createdByName, created_at: row.createdAt,
  }, "logs", row);
}

export async function addPdCatheterEval(input: Omit<PdCatheterEval, "id" | "createdAt">): Promise<PdCatheterEval> {
  const row: PdCatheterEval = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_catheter_evals", {
    id: row.id, patient_key: row.patientKey, evaluated_at: row.evaluatedAt, site: row.site, orifice: row.orifice,
    hyperemia: row.hyperemia, secretion: row.secretion, pain: row.pain, crust: row.crust, dressing: row.dressing,
    notes: row.notes, created_by: row.createdBy, created_by_name: row.createdByName, created_at: row.createdAt,
  }, "catheter", row);
}

export async function addPdPeritonitis(input: Omit<PdPeritonitis, "id" | "createdAt">): Promise<PdPeritonitis> {
  const row: PdPeritonitis = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_peritonitis", {
    id: row.id, patient_key: row.patientKey, onset_date: row.onsetDate, symptoms: row.symptoms, cloudy_effluent: row.cloudyEffluent,
    abdominal_pain: row.abdominalPain, cell_count: row.cellCount, pmn: row.pmn, gram: row.gram, culture: row.culture,
    organism: row.organism, antibiotic: row.antibiotic, route: row.route, start_date: row.startDate, end_date: row.endDate,
    clinical_response: row.clinicalResponse, catheter_removed: row.catheterRemoved, recurrence_kind: row.recurrenceKind,
    outcome: row.outcome, created_by: row.createdBy, created_by_name: row.createdByName, created_at: row.createdAt,
  }, "peritonitis", row);
}

export async function addPdAdequacy(input: Omit<PdAdequacy, "id" | "createdAt">): Promise<PdAdequacy> {
  const row: PdAdequacy = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_adequacy", {
    id: row.id, patient_key: row.patientKey, measured_at: row.measuredAt, ktv: row.ktv, residual_clearance: row.residualClearance,
    residual_urine_ml: row.residualUrineMl, ultrafiltration_ml: row.ultrafiltrationMl, pet: row.pet, transporter: row.transporter,
    notes: row.notes, created_by: row.createdBy, created_by_name: row.createdByName, created_at: row.createdAt,
  }, "adequacy", row);
}

export async function addPdTraining(input: Omit<PdTraining, "id" | "createdAt">): Promise<PdTraining> {
  const row: PdTraining = { ...input, id: uuid(), createdAt: new Date().toISOString() };
  return insertRow("pd_training", {
    id: row.id, patient_key: row.patientKey, evaluated_at: row.evaluatedAt, items: row.items, notes: row.notes,
    created_by: row.createdBy, created_by_name: row.createdByName, created_at: row.createdAt,
  }, "training", row);
}

async function listByPatient<T>(table: string, localKey: keyof LocalDb, patientKey: string, map: (r: Record<string, unknown>) => T): Promise<T[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from(table).select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map((r) => map(r as Record<string, unknown>));
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return ([...((db[localKey] as unknown as { patientKey: string; createdAt: string }[]))]
    .filter((x) => x.patientKey === patientKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) as unknown as T[];
}

export async function listPdPrescriptions(patientKey: string) {
  return listByPatient<PdPrescription>("pd_prescriptions", "prescriptions", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey),
    exchanges: (r.exchanges as number) ?? null, volumeMl: (r.volume_ml as number) ?? (r.volumeMl as number) ?? null,
    dwellHours: (r.dwell_hours as number) ?? (r.dwellHours as number) ?? null,
    solution: (r.solution as string) ?? null, glucosePercent: (r.glucose_percent as string) ?? (r.glucosePercent as string) ?? null,
    icodextrin: r.icodextrin === true, totalDailyMl: (r.total_daily_ml as number) ?? (r.totalDailyMl as number) ?? null,
    lastFill: (r.last_fill as string) ?? (r.lastFill as string) ?? null, notes: (r.notes as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt), createdBy: String(r.created_by ?? r.createdBy ?? ""),
    createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
  }));
}
export async function listPdDailyLogs(patientKey: string) {
  return listByPatient<PdDailyLog>("pd_daily_logs", "logs", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey), loggedAt: String(r.logged_at ?? r.loggedAt),
    weightKg: r.weight_kg as number ?? (r.weightKg as number) ?? null,
    systolic: (r.systolic as number) ?? null, diastolic: (r.diastolic as number) ?? null,
    urineMl: (r.urine_ml as number) ?? (r.urineMl as number) ?? null,
    ultrafiltrationMl: (r.ultrafiltration_ml as number) ?? (r.ultrafiltrationMl as number) ?? null,
    drainedMl: (r.drained_ml as number) ?? (r.drainedMl as number) ?? null,
    balanceMl: (r.balance_ml as number) ?? (r.balanceMl as number) ?? null,
    edema: (r.edema as string) ?? null, glucoseMgDl: (r.glucose_mg_dl as number) ?? (r.glucoseMgDl as number) ?? null,
    effluent: (r.effluent as string) ?? null, abdominalPain: r.abdominal_pain === true || r.abdominalPain === true,
    fever: r.fever === true, missedExchanges: r.missed_exchanges === true || r.missedExchanges === true,
    events: (r.events as string) ?? null, createdBy: String(r.created_by ?? r.createdBy ?? ""),
    createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  }));
}
export async function listPdCatheterEvals(patientKey: string) {
  return listByPatient<PdCatheterEval>("pd_catheter_evals", "catheter", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey),
    evaluatedAt: String(r.evaluated_at ?? r.evaluatedAt), site: (r.site as string) ?? null,
    orifice: (r.orifice as string) ?? null, hyperemia: r.hyperemia === true, secretion: r.secretion === true,
    pain: r.pain === true, crust: r.crust === true, dressing: (r.dressing as string) ?? null, notes: (r.notes as string) ?? null,
    createdBy: String(r.created_by ?? r.createdBy ?? ""), createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  }));
}
export async function listPdPeritonitis(patientKey: string) {
  return listByPatient<PdPeritonitis>("pd_peritonitis", "peritonitis", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey),
    onsetDate: String(r.onset_date ?? r.onsetDate), symptoms: (r.symptoms as string) ?? null,
    cloudyEffluent: r.cloudy_effluent === true || r.cloudyEffluent === true,
    abdominalPain: r.abdominal_pain === true || r.abdominalPain === true,
    cellCount: (r.cell_count as string) ?? (r.cellCount as string) ?? null,
    pmn: (r.pmn as string) ?? null, gram: (r.gram as string) ?? null, culture: (r.culture as string) ?? null,
    organism: (r.organism as string) ?? null, antibiotic: (r.antibiotic as string) ?? null, route: (r.route as string) ?? null,
    startDate: (r.start_date as string) ?? (r.startDate as string) ?? null,
    endDate: (r.end_date as string) ?? (r.endDate as string) ?? null,
    clinicalResponse: (r.clinical_response as string) ?? (r.clinicalResponse as string) ?? null,
    catheterRemoved: r.catheter_removed === true || r.catheterRemoved === true,
    recurrenceKind: (r.recurrence_kind as string) ?? (r.recurrenceKind as string) ?? null,
    outcome: (r.outcome as string) ?? null,
    createdBy: String(r.created_by ?? r.createdBy ?? ""), createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  }));
}
export async function listPdAdequacy(patientKey: string) {
  return listByPatient<PdAdequacy>("pd_adequacy", "adequacy", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey),
    measuredAt: String(r.measured_at ?? r.measuredAt),
    ktv: (r.ktv as number) ?? null, residualClearance: (r.residual_clearance as number) ?? (r.residualClearance as number) ?? null,
    residualUrineMl: (r.residual_urine_ml as number) ?? (r.residualUrineMl as number) ?? null,
    ultrafiltrationMl: (r.ultrafiltration_ml as number) ?? (r.ultrafiltrationMl as number) ?? null,
    pet: (r.pet as string) ?? null, transporter: (r.transporter as string) ?? null, notes: (r.notes as string) ?? null,
    createdBy: String(r.created_by ?? r.createdBy ?? ""), createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  }));
}
export async function listPdTraining(patientKey: string) {
  return listByPatient<PdTraining>("pd_training", "training", patientKey, (r) => ({
    id: String(r.id), patientKey: String(r.patient_key ?? r.patientKey),
    evaluatedAt: String(r.evaluated_at ?? r.evaluatedAt),
    items: ((r.items as Record<string, PdTrainingStatus>) || {}),
    notes: (r.notes as string) ?? null,
    createdBy: String(r.created_by ?? r.createdBy ?? ""), createdByName: (r.created_by_name as string) ?? (r.createdByName as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  }));
}

export async function getPdBundle(patientKey: string) {
  const [profile, prescriptions, logs, catheter, peritonitis, adequacy, training] = await Promise.all([
    getPdProfile(patientKey), listPdPrescriptions(patientKey), listPdDailyLogs(patientKey),
    listPdCatheterEvals(patientKey), listPdPeritonitis(patientKey), listPdAdequacy(patientKey), listPdTraining(patientKey),
  ]);
  return { profile, prescriptions, logs, catheter, peritonitis, adequacy, training };
}
