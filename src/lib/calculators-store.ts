import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { CALC_TOOLS } from "./calculators/catalog";
import type { CalcResult } from "./calculators/types";
import { getSupabaseAdmin } from "./supabase-admin";

export type CalcHistoryRow = {
  id: string;
  doctorId: string;
  patientKey: string | null;
  toolId: string;
  status: string;
  headline: string;
  result: CalcResult;
  createdAt: string;
};

export type CalcAssessment = {
  id: string;
  doctorId: string;
  patientKey: string;
  toolId: string;
  payload: Record<string, string | number | boolean | null>;
  assessedBy: string | null;
  context: string | null;
  note: string | null;
  createdAt: string;
};

export type CalcDecision = {
  id: string;
  doctorId: string;
  patientKey: string;
  toolId: string;
  item: string;
  rule: string;
  decision: string;
  note: string | null;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "calc-history.json");
const ASSESS_FILE = path.join(DATA_DIR, "calc-assessments.json");
const DECISION_FILE = path.join(DATA_DIR, "calc-decisions.json");

let historyMissing = false;
let assessMissing = false;
let decisionMissing = false;
let catalogMissing = false;

function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return Boolean(e.message && /relation .* does not exist|could not find the table/i.test(e.message));
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

function mapHistory(r: Record<string, unknown>): CalcHistoryRow {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId ?? ""),
    patientKey: (r.patient_key as string | null) ?? (r.patientKey as string | null) ?? null,
    toolId: String(r.tool_id ?? r.toolId ?? ""),
    status: String(r.status ?? ""),
    headline: String(r.headline ?? ""),
    result: (r.result as CalcResult) ?? ({} as CalcResult),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}
function mapAssess(r: Record<string, unknown>): CalcAssessment {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId ?? ""),
    patientKey: String(r.patient_key ?? r.patientKey ?? ""),
    toolId: String(r.tool_id ?? r.toolId ?? ""),
    payload: (r.payload as CalcAssessment["payload"]) || {},
    assessedBy: (r.assessed_by as string | null) ?? (r.assessedBy as string | null) ?? null,
    context: (r.context as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}
function mapDecision(r: Record<string, unknown>): CalcDecision {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId ?? ""),
    patientKey: String(r.patient_key ?? r.patientKey ?? ""),
    toolId: String(r.tool_id ?? r.toolId ?? ""),
    item: String(r.item ?? ""),
    rule: String(r.rule ?? ""),
    decision: String(r.decision ?? ""),
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}

export async function appendCalcResult(row: Omit<CalcHistoryRow, "id" | "createdAt">): Promise<CalcHistoryRow> {
  const saved: CalcHistoryRow = {
    ...row,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (getSupabaseAdmin() && !historyMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("calc_results")
      .insert({
        id: saved.id,
        doctor_id: saved.doctorId,
        patient_key: saved.patientKey,
        tool_id: saved.toolId,
        status: saved.status,
        headline: saved.headline,
        result: saved.result,
        created_at: saved.createdAt,
      })
      .select("*")
      .maybeSingle();
    if (!error) return data ? mapHistory(data as Record<string, unknown>) : saved;
    if (isMissing(error)) historyMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcHistoryRow>(HISTORY_FILE);
  rows.push(saved);
  await writeJson(HISTORY_FILE, rows);
  return saved;
}

export async function listCalcHistory(opts: {
  doctorId: string;
  patientKey?: string | null;
  toolId?: string;
  limit?: number;
}): Promise<CalcHistoryRow[]> {
  const limit = opts.limit ?? 80;
  if (getSupabaseAdmin() && !historyMissing) {
    const s = getSupabaseAdmin()!;
    let q = s.from("calc_results").select("*").eq("doctor_id", opts.doctorId).order("created_at", { ascending: false }).limit(limit);
    if (opts.patientKey) q = q.eq("patient_key", opts.patientKey);
    if (opts.toolId) q = q.eq("tool_id", opts.toolId);
    const { data, error } = await q;
    if (!error) return (data || []).map((r) => mapHistory(r as Record<string, unknown>));
    if (isMissing(error)) historyMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcHistoryRow>(HISTORY_FILE);
  return rows
    .filter((r) => r.doctorId === opts.doctorId)
    .filter((r) => !opts.patientKey || r.patientKey === opts.patientKey)
    .filter((r) => !opts.toolId || r.toolId === opts.toolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function addAssessment(row: Omit<CalcAssessment, "id" | "createdAt">): Promise<CalcAssessment> {
  const saved: CalcAssessment = { ...row, id: randomUUID(), createdAt: new Date().toISOString() };
  if (getSupabaseAdmin() && !assessMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("calc_assessments")
      .insert({
        id: saved.id,
        doctor_id: saved.doctorId,
        patient_key: saved.patientKey,
        tool_id: saved.toolId,
        payload: saved.payload,
        assessed_by: saved.assessedBy,
        context: saved.context,
        note: saved.note,
        created_at: saved.createdAt,
      })
      .select("*")
      .maybeSingle();
    if (!error) return data ? mapAssess(data as Record<string, unknown>) : saved;
    if (isMissing(error)) assessMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcAssessment>(ASSESS_FILE);
  rows.push(saved);
  await writeJson(ASSESS_FILE, rows);
  return saved;
}

export async function listAssessments(doctorId: string, patientKey: string, toolId?: string): Promise<CalcAssessment[]> {
  if (getSupabaseAdmin() && !assessMissing) {
    const s = getSupabaseAdmin()!;
    let q = s.from("calc_assessments").select("*").eq("doctor_id", doctorId).eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (toolId) q = q.eq("tool_id", toolId);
    const { data, error } = await q;
    if (!error) return (data || []).map((r) => mapAssess(r as Record<string, unknown>));
    if (isMissing(error)) assessMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcAssessment>(ASSESS_FILE);
  return rows
    .filter((r) => r.doctorId === doctorId && r.patientKey === patientKey)
    .filter((r) => !toolId || r.toolId === toolId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function latestAssessmentsMap(doctorId: string, patientKey: string): Promise<Record<string, CalcAssessment>> {
  const list = await listAssessments(doctorId, patientKey);
  const map: Record<string, CalcAssessment> = {};
  for (const a of list) {
    if (!map[a.toolId]) map[a.toolId] = a;
  }
  return map;
}

export async function addDecision(row: Omit<CalcDecision, "id" | "createdAt">): Promise<CalcDecision> {
  const saved: CalcDecision = { ...row, id: randomUUID(), createdAt: new Date().toISOString() };
  if (getSupabaseAdmin() && !decisionMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("calc_decisions")
      .insert({
        id: saved.id,
        doctor_id: saved.doctorId,
        patient_key: saved.patientKey,
        tool_id: saved.toolId,
        item: saved.item,
        rule: saved.rule,
        decision: saved.decision,
        note: saved.note,
        created_at: saved.createdAt,
      })
      .select("*")
      .maybeSingle();
    if (!error) return data ? mapDecision(data as Record<string, unknown>) : saved;
    if (isMissing(error)) decisionMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcDecision>(DECISION_FILE);
  rows.push(saved);
  await writeJson(DECISION_FILE, rows);
  return saved;
}

export async function listDecisions(doctorId: string, patientKey: string): Promise<CalcDecision[]> {
  if (getSupabaseAdmin() && !decisionMissing) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("calc_decisions")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("patient_key", patientKey)
      .order("created_at", { ascending: false });
    if (!error) return (data || []).map((r) => mapDecision(r as Record<string, unknown>));
    if (isMissing(error)) decisionMissing = true;
    else throw error;
  }
  const rows = await readJson<CalcDecision>(DECISION_FILE);
  return rows.filter((r) => r.doctorId === doctorId && r.patientKey === patientKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function assessmentsToExtra(map: Record<string, CalcAssessment>): Record<string, string | number | boolean | null> {
  const extra: Record<string, string | number | boolean | null> = {};
  const cfs = map.cfs;
  if (cfs) {
    extra.cfs_score = cfs.payload.cfs_score ?? null;
    extra.cfs_at = cfs.createdAt;
    extra.cfs_by = cfs.assessedBy;
    extra.cfs_context = cfs.context;
    extra.cfs_note = cfs.note;
  }
  const fn = map.function_basic;
  if (fn) {
    extra.abvd = fn.payload.abvd ?? null;
    extra.aivd = fn.payload.aivd ?? null;
    extra.mobilidade = fn.payload.mobilidade ?? null;
    extra.dependencia = fn.payload.dependencia ?? null;
    extra.cuidador = fn.payload.cuidador ?? null;
  }
  const spict = map.spict;
  if (spict) {
    extra.spict_avaliado = true;
    extra.spict_indicadores = spict.payload.spict_indicadores ?? null;
    extra.spict_note = spict.note;
    extra.spict_at = spict.createdAt;
  }
  const necpal = map.necpal;
  if (necpal) {
    extra.necpal_avaliado = true;
    extra.necpal_surpresa_nao = necpal.payload.necpal_surpresa_nao ?? null;
    extra.necpal_indicadores = necpal.payload.necpal_indicadores ?? null;
    extra.necpal_note = necpal.note;
    extra.necpal_at = necpal.createdAt;
  }
  const pps = map.pps;
  if (pps) {
    extra.pps_score = pps.payload.pps_score ?? null;
    extra.pps_at = pps.createdAt;
  }
  return extra;
}

/** Histórico de PPS: atual + anterior (não sobrescreve). */
export function ppsPrevious(list: CalcAssessment[]): number | null {
  const rows = list.filter((a) => a.toolId === "pps" && a.payload.pps_score != null);
  if (rows.length < 2) return rows.length === 1 ? null : null;
  const prev = rows[1]?.payload.pps_score;
  return typeof prev === "number" ? prev : Number(prev) || null;
}

export async function syncToolCatalog(): Promise<void> {
  if (!getSupabaseAdmin() || catalogMissing) return;
  const s = getSupabaseAdmin()!;
  const rows = CALC_TOOLS.map((t) => ({
    id: t.id,
    section: t.section,
    title: t.title,
    version: t.version,
    published: t.published,
    reviewed_at: t.reviewedAt,
    source: t.source,
    population: t.population,
    formula: t.formula,
    limitations: t.limitations,
    official_url: t.officialUrl || null,
    license_note: t.licenseNote || null,
    active: t.active,
  }));
  const { error } = await s.from("calc_tool_catalog").upsert(rows, { onConflict: "id" });
  if (error && isMissing(error)) catalogMissing = true;
}
