import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";
import type { Filter } from "./research";

/* ============================================================================
   Estudos científicos + casos interessantes (por médico).
   Segue o padrão do projeto: Supabase quando disponível, senão JSON local.
   Isolamento por médico (doctor_id) — nunca mistura dados entre médicos.
   ============================================================================ */

export type StudyType =
  | "relato_caso"
  | "serie_casos"
  | "transversal"
  | "coorte_retro"
  | "coorte_prosp"
  | "caso_controle"
  | "observacional"
  | "revisao_narrativa"
  | "revisao_integrativa"
  | "revisao_sistematica"
  | "metanalise"
  | "projeto_livre";

export type StudyStatus = "rascunho" | "coleta" | "analise" | "escrita" | "submetido" | "concluido";

export interface Study {
  id: string;
  doctorId: string;
  type: StudyType;
  title: string;
  question: string;
  filters: Filter[];
  variables: string[];
  journal?: string | null;
  status: StudyStatus;
  createdAt: string;
  updatedAt: string;
}

export type CaseCategory =
  | "relato"
  | "serie"
  | "raro"
  | "discussao"
  | "aula"
  | "artigo"
  | "congresso"
  | "longitudinal"
  | "pesquisa";

export interface InterestingCase {
  id: string;
  doctorId: string;
  patientKey: string;
  patientName: string;
  categories: CaseCategory[];
  note?: string | null; // anotação científica PRIVADA (não aparece ao paciente)
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STUDIES_FILE = path.join(DATA_DIR, "research-studies.json");
const CASES_FILE = path.join(DATA_DIR, "research-cases.json");
let studiesTableMissing = false;
let casesTableMissing = false;

function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function studiesActive() {
  return Boolean(getSupabaseAdmin()) && !studiesTableMissing;
}
function casesActive() {
  return Boolean(getSupabaseAdmin()) && !casesTableMissing;
}

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T[];
  } catch {
    return [];
  }
}
async function writeJson<T>(file: string, rows: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

/* ------------------------------- Estudos --------------------------------- */

function mapStudy(r: Record<string, unknown>): Study {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId ?? ""),
    type: (r.type as StudyType) ?? "projeto_livre",
    title: String(r.title ?? ""),
    question: String(r.question ?? ""),
    filters: (r.filters as Filter[]) ?? [],
    variables: (r.variables as string[]) ?? [],
    journal: (r.journal as string | null) ?? null,
    status: (r.status as StudyStatus) ?? "rascunho",
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}
function studyRow(s: Study) {
  return {
    id: s.id,
    doctor_id: s.doctorId,
    type: s.type,
    title: s.title,
    question: s.question,
    filters: s.filters,
    variables: s.variables,
    journal: s.journal ?? null,
    status: s.status,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

export async function listStudies(doctorId: string): Promise<Study[]> {
  if (studiesActive()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("research_studies").select("*").eq("doctor_id", doctorId).order("updated_at", { ascending: false });
    if (!error) return (data || []).map(mapStudy);
    if (isMissing(error)) studiesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<Study>(STUDIES_FILE);
  return rows.filter((r) => r.doctorId === doctorId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getStudy(doctorId: string, id: string): Promise<Study | null> {
  if (studiesActive()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("research_studies").select("*").eq("id", id).maybeSingle();
    if (!error) {
      const st = data ? mapStudy(data) : null;
      return st && st.doctorId === doctorId ? st : null;
    }
    if (isMissing(error)) studiesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<Study>(STUDIES_FILE);
  const st = rows.find((r) => r.id === id) || null;
  return st && st.doctorId === doctorId ? st : null;
}

export async function createStudy(input: Omit<Study, "id" | "createdAt" | "updatedAt">): Promise<Study> {
  const now = new Date().toISOString();
  const study: Study = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  if (studiesActive()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("research_studies").insert(studyRow(study));
    if (!error) return study;
    if (isMissing(error)) studiesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<Study>(STUDIES_FILE);
  rows.push(study);
  await writeJson(STUDIES_FILE, rows);
  return study;
}

export async function updateStudy(doctorId: string, id: string, patch: Partial<Study>): Promise<Study | null> {
  const current = await getStudy(doctorId, id);
  if (!current) return null;
  const updated: Study = {
    ...current,
    ...patch,
    id: current.id,
    doctorId: current.doctorId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  if (studiesActive()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("research_studies").update(studyRow(updated)).eq("id", id).eq("doctor_id", doctorId);
    if (!error) return updated;
    if (isMissing(error)) studiesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<Study>(STUDIES_FILE);
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) {
    rows[i] = updated;
    await writeJson(STUDIES_FILE, rows);
  }
  return updated;
}

export async function deleteStudy(doctorId: string, id: string): Promise<boolean> {
  const current = await getStudy(doctorId, id);
  if (!current) return false;
  if (studiesActive()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("research_studies").delete().eq("id", id).eq("doctor_id", doctorId);
    if (!error) return true;
    if (isMissing(error)) studiesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<Study>(STUDIES_FILE);
  await writeJson(STUDIES_FILE, rows.filter((r) => r.id !== id));
  return true;
}

/* --------------------------- Casos interessantes ------------------------- */

function mapCase(r: Record<string, unknown>): InterestingCase {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId ?? ""),
    patientKey: String(r.patient_key ?? r.patientKey ?? ""),
    patientName: String(r.patient_name ?? r.patientName ?? ""),
    categories: (r.categories as CaseCategory[]) ?? [],
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}
function caseRow(c: InterestingCase) {
  return {
    id: c.id,
    doctor_id: c.doctorId,
    patient_key: c.patientKey,
    patient_name: c.patientName,
    categories: c.categories,
    note: c.note ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export async function listCases(doctorId: string): Promise<InterestingCase[]> {
  if (casesActive()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("research_cases").select("*").eq("doctor_id", doctorId).order("updated_at", { ascending: false });
    if (!error) return (data || []).map(mapCase);
    if (isMissing(error)) casesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<InterestingCase>(CASES_FILE);
  return rows.filter((r) => r.doctorId === doctorId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCase(doctorId: string, patientKey: string): Promise<InterestingCase | null> {
  if (casesActive()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("research_cases").select("*").eq("doctor_id", doctorId).eq("patient_key", patientKey).maybeSingle();
    if (!error) return data ? mapCase(data) : null;
    if (isMissing(error)) casesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<InterestingCase>(CASES_FILE);
  return rows.find((r) => r.doctorId === doctorId && r.patientKey === patientKey) || null;
}

/** Cria/atualiza a marcação do caso. categories vazio + note vazio => remove. */
export async function upsertCase(
  doctorId: string,
  patientKey: string,
  patientName: string,
  patch: { categories?: CaseCategory[]; note?: string | null }
): Promise<InterestingCase | null> {
  const existing = await getCase(doctorId, patientKey);
  const categories = patch.categories ?? existing?.categories ?? [];
  const note = patch.note !== undefined ? patch.note : existing?.note ?? null;
  if (categories.length === 0 && !(note && note.trim())) {
    if (existing) await deleteCase(doctorId, patientKey);
    return null;
  }
  const now = new Date().toISOString();
  const record: InterestingCase = {
    id: existing?.id ?? randomUUID(),
    doctorId,
    patientKey,
    patientName: patientName || existing?.patientName || "",
    categories,
    note: note ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (casesActive()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("research_cases").upsert(caseRow(record), { onConflict: "doctor_id,patient_key" });
    if (!error) return record;
    if (isMissing(error)) casesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<InterestingCase>(CASES_FILE);
  const i = rows.findIndex((r) => r.doctorId === doctorId && r.patientKey === patientKey);
  if (i >= 0) rows[i] = record;
  else rows.push(record);
  await writeJson(CASES_FILE, rows);
  return record;
}

export async function deleteCase(doctorId: string, patientKey: string): Promise<void> {
  if (casesActive()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("research_cases").delete().eq("doctor_id", doctorId).eq("patient_key", patientKey);
    if (!error) return;
    if (isMissing(error)) casesTableMissing = true;
    else throw error;
  }
  const rows = await readJson<InterestingCase>(CASES_FILE);
  await writeJson(CASES_FILE, rows.filter((r) => !(r.doctorId === doctorId && r.patientKey === patientKey)));
}
