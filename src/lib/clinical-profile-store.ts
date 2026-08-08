import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";
import type { ClinicalProfileData } from "./clinical-fields";

/** Proveniência por campo: de onde veio o valor atual. */
export type FieldSource = "manual" | "evolução" | "pdf" | "cálculo" | "importação";
export interface FieldMeta {
  source: FieldSource;
  by?: string | null;
  at: string;
}
export interface HistoryEntry {
  field: string;
  from: unknown;
  to: unknown;
  source: FieldSource;
  by?: string | null;
  at: string;
}

export interface ClinicalProfile {
  patientKey: string;
  doctorId?: string | null;
  data: ClinicalProfileData;
  meta: Record<string, FieldMeta>;
  history: HistoryEntry[];
  updatedBy?: string | null;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinical-profiles.json");
let tableMissing = false;

function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
async function readFile(): Promise<ClinicalProfile[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as ClinicalProfile[];
  } catch {
    return [];
  }
}
async function writeFile(list: ClinicalProfile[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
function mapRow(r: Record<string, unknown>): ClinicalProfile {
  return {
    patientKey: String(r.patient_key),
    doctorId: (r.doctor_id as string | null) ?? null,
    data: (r.data as ClinicalProfileData) ?? {},
    meta: (r.meta as Record<string, FieldMeta>) ?? {},
    history: Array.isArray(r.history) ? (r.history as HistoryEntry[]) : [],
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

function normalize(p: Partial<ClinicalProfile> & { patientKey: string }): ClinicalProfile {
  return {
    patientKey: p.patientKey,
    doctorId: p.doctorId ?? null,
    data: p.data ?? {},
    meta: p.meta ?? {},
    history: Array.isArray(p.history) ? p.history : [],
    updatedBy: p.updatedBy ?? null,
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  };
}

export async function getProfile(patientKey: string): Promise<ClinicalProfile | null> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("patient_clinical_profile").select("*").eq("patient_key", key).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return data ? mapRow(data as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  const found = list.find((p) => p.patientKey === key);
  return found ? normalize(found) : null;
}

export async function getProfilesByDoctor(doctorId: string): Promise<ClinicalProfile[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("patient_clinical_profile").select("*").eq("doctor_id", doctorId);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list.filter((p) => p.doctorId === doctorId).map(normalize);
}

async function persist(row: ClinicalProfile): Promise<ClinicalProfile> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("patient_clinical_profile").upsert(
      {
        patient_key: row.patientKey,
        doctor_id: row.doctorId,
        data: row.data,
        meta: row.meta,
        history: row.history,
        updated_by: row.updatedBy,
        updated_at: row.updatedAt,
      },
      { onConflict: "patient_key" }
    );
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return row;
    }
  }
  const list = await readFile();
  const idx = list.findIndex((p) => p.patientKey === row.patientKey);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  await writeFile(list);
  return row;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || v === "desconhecido" || (Array.isArray(v) && v.length === 0);
}
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Aplica alterações a campos específicos, registrando proveniência e histórico.
 * Não remove campos não citados (merge). Usado pela extração da evolução/PDF.
 */
export async function applyProfileChanges(
  patientKey: string,
  doctorId: string | null,
  by: string | null,
  changes: Record<string, unknown>,
  source: FieldSource
): Promise<ClinicalProfile> {
  const key = patientKey.toLowerCase().trim();
  const current = (await getProfile(key)) || normalize({ patientKey: key, doctorId });
  const data = { ...current.data };
  const meta = { ...current.meta };
  const history = [...current.history];
  const now = new Date().toISOString();

  for (const [field, rawTo] of Object.entries(changes)) {
    const to = isEmpty(rawTo) ? undefined : rawTo;
    const from = data[field];
    if (sameValue(from, to)) continue;
    history.push({ field, from: from ?? null, to: to ?? null, source, by, at: now });
    if (to === undefined) {
      delete data[field];
      delete meta[field];
    } else {
      data[field] = to;
      meta[field] = { source, by, at: now };
    }
  }

  return persist(normalize({ patientKey: key, doctorId: doctorId ?? current.doctorId ?? null, data, meta, history, updatedBy: by, updatedAt: now }));
}

/** Substituição completa (edição manual): diffa contra o atual e registra histórico. */
export async function replaceProfileData(
  patientKey: string,
  doctorId: string | null,
  by: string | null,
  newData: ClinicalProfileData,
  source: FieldSource = "manual"
): Promise<ClinicalProfile> {
  const key = patientKey.toLowerCase().trim();
  const current = (await getProfile(key)) || normalize({ patientKey: key, doctorId });
  const allFields = new Set([...Object.keys(current.data), ...Object.keys(newData)]);
  const changes: Record<string, unknown> = {};
  for (const f of allFields) {
    const to = isEmpty(newData[f]) ? undefined : newData[f];
    if (!sameValue(current.data[f], to)) changes[f] = to ?? "";
  }
  return applyProfileChanges(key, doctorId, by, changes, source);
}
