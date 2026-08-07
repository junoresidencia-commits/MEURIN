import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type VitalKind = "bp" | "glucose" | "weight" | "symptom";

export interface HomeRecord {
  id: string;
  patientEmail: string;
  kind: VitalKind;
  systolic?: number | null;
  diastolic?: number | null;
  heartRate?: number | null;
  glucoseMgDl?: number | null;
  glucoseContext?: string | null;
  weightKg?: number | null;
  arm?: string | null;
  bodyPosition?: string | null;
  medContext?: string | null;
  symptoms?: string | null;
  note?: string | null;
  measuredAt: string;
  createdAt: string;
}

export interface FoodLog {
  id: string;
  patientEmail: string;
  food: string;
  meal?: string | null;
  quantity?: string | null;
  note?: string | null;
  loggedAt: string;
  createdAt: string;
}

export interface ClinicalNote {
  id: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  chiefComplaint?: string | null;
  history?: string | null;
  assessment?: string | null;
  plan?: string | null;
  sharedWithPatient: boolean;
  createdAt: string;
}

export type DocumentType = "receita" | "exame" | "relatorio";

export interface ClinicalDocument {
  id: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  doctorCrm?: string | null;
  type: DocumentType;
  title: string;
  body: string;
  sharedWithPatient: boolean;
  createdAt: string;
}

export interface PatientData {
  records: HomeRecord[];
  food: FoodLog[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "patient-records.json");

/** Tabelas do Supabase ainda não criadas — ficam no fallback local até a migration rodar. */
const missingTables = new Set<string>();

function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}

function supabaseActive(table: string) {
  return Boolean(getSupabaseAdmin()) && !missingTables.has(table);
}

/* --------------------------- JSON fallback --------------------------- */

type FileShape = {
  records: HomeRecord[];
  food: FoodLog[];
  notes: ClinicalNote[];
  documents: ClinicalDocument[];
  labs: LabResult[];
};

async function readFile(): Promise<FileShape> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileShape>;
    return {
      records: parsed.records ?? [],
      food: parsed.food ?? [],
      notes: parsed.notes ?? [],
      documents: parsed.documents ?? [],
      labs: parsed.labs ?? [],
    };
  } catch {
    return { records: [], food: [], notes: [], documents: [], labs: [] };
  }
}

async function writeFile(data: FileShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

/* --------------------------- Row mappers --------------------------- */

function mapRecordRow(row: Record<string, unknown>): HomeRecord {
  return {
    id: String(row.id),
    patientEmail: String(row.patient_email),
    kind: String(row.kind) as VitalKind,
    systolic: row.systolic as number | null,
    diastolic: row.diastolic as number | null,
    heartRate: row.heart_rate as number | null,
    glucoseMgDl: row.glucose_mg_dl as number | null,
    glucoseContext: (row.glucose_context as string | null) ?? null,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    arm: (row.arm as string | null) ?? null,
    bodyPosition: (row.body_position as string | null) ?? null,
    medContext: (row.med_context as string | null) ?? null,
    symptoms: (row.symptoms as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    measuredAt: new Date(String(row.measured_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapFoodRow(row: Record<string, unknown>): FoodLog {
  return {
    id: String(row.id),
    patientEmail: String(row.patient_email),
    food: String(row.food),
    meal: (row.meal as string | null) ?? null,
    quantity: (row.quantity as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    loggedAt: new Date(String(row.logged_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

/* --------------------------- Public API --------------------------- */

export type NewHomeRecord = Omit<HomeRecord, "id" | "createdAt" | "measuredAt"> & {
  measuredAt?: string;
};

export async function addHomeRecord(input: NewHomeRecord): Promise<HomeRecord> {
  const now = new Date().toISOString();
  const record: HomeRecord = {
    id: uuid(),
    createdAt: now,
    measuredAt: input.measuredAt || now,
    ...input,
  };

  if (supabaseActive("home_records")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("home_records").insert({
      id: record.id,
      patient_email: record.patientEmail,
      kind: record.kind,
      systolic: record.systolic ?? null,
      diastolic: record.diastolic ?? null,
      heart_rate: record.heartRate ?? null,
      glucose_mg_dl: record.glucoseMgDl ?? null,
      glucose_context: record.glucoseContext ?? null,
      weight_kg: record.weightKg ?? null,
      arm: record.arm ?? null,
      body_position: record.bodyPosition ?? null,
      med_context: record.medContext ?? null,
      symptoms: record.symptoms ?? null,
      note: record.note ?? null,
      measured_at: record.measuredAt,
      created_at: record.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) {
        missingTables.add("home_records");
      } else {
        throw error;
      }
    } else {
      return record;
    }
  }

  const data = await readFile();
  data.records.push(record);
  await writeFile(data);
  return record;
}

export async function addFoodLog(
  input: Omit<FoodLog, "id" | "createdAt" | "loggedAt"> & { loggedAt?: string }
): Promise<FoodLog> {
  const now = new Date().toISOString();
  const log: FoodLog = {
    id: uuid(),
    createdAt: now,
    loggedAt: input.loggedAt || now,
    ...input,
  };

  if (supabaseActive("home_food_logs")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("home_food_logs").insert({
      id: log.id,
      patient_email: log.patientEmail,
      food: log.food,
      meal: log.meal ?? null,
      quantity: log.quantity ?? null,
      note: log.note ?? null,
      logged_at: log.loggedAt,
      created_at: log.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) {
        missingTables.add("home_food_logs");
      } else {
        throw error;
      }
    } else {
      return log;
    }
  }

  const data = await readFile();
  data.food.push(log);
  await writeFile(data);
  return log;
}

export async function getPatientData(email: string, limit = 60): Promise<PatientData> {
  const normalized = email.toLowerCase().trim();

  if (supabaseActive("home_records") && supabaseActive("home_food_logs")) {
    const supabase = getSupabaseAdmin()!;
    const [recordsRes, foodRes] = await Promise.all([
      supabase
        .from("home_records")
        .select("*")
        .eq("patient_email", normalized)
        .order("measured_at", { ascending: false })
        .limit(limit),
      supabase
        .from("home_food_logs")
        .select("*")
        .eq("patient_email", normalized)
        .order("logged_at", { ascending: false })
        .limit(limit),
    ]);

    if (recordsRes.error && isMissingTableError(recordsRes.error)) {
      missingTables.add("home_records");
    } else if (recordsRes.error) {
      throw recordsRes.error;
    } else if (foodRes.error && isMissingTableError(foodRes.error)) {
      missingTables.add("home_food_logs");
    } else if (foodRes.error) {
      throw foodRes.error;
    } else {
      return {
        records: (recordsRes.data ?? []).map((r) => mapRecordRow(r as Record<string, unknown>)),
        food: (foodRes.data ?? []).map((r) => mapFoodRow(r as Record<string, unknown>)),
      };
    }
  }

  const data = await readFile();
  const records = data.records
    .filter((r) => r.patientEmail === normalized)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    .slice(0, limit);
  const food = data.food
    .filter((r) => r.patientEmail === normalized)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, limit);
  return { records, food };
}

export function latestOfKind(records: HomeRecord[], kind: VitalKind): HomeRecord | null {
  return records.find((r) => r.kind === kind) ?? null;
}

/* --------------------------- Clinical notes (evolução) --------------------------- */

function mapNoteRow(row: Record<string, unknown>): ClinicalNote {
  return {
    id: String(row.id),
    patientEmail: String(row.patient_email),
    doctorId: String(row.doctor_id),
    doctorName: String(row.doctor_name),
    chiefComplaint: (row.chief_complaint as string | null) ?? null,
    history: (row.history as string | null) ?? null,
    assessment: (row.assessment as string | null) ?? null,
    plan: (row.plan as string | null) ?? null,
    sharedWithPatient: Boolean(row.shared_with_patient),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function addClinicalNote(
  input: Omit<ClinicalNote, "id" | "createdAt">
): Promise<ClinicalNote> {
  const note: ClinicalNote = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
    patientEmail: input.patientEmail.toLowerCase().trim(),
  };

  if (supabaseActive("clinical_notes")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("clinical_notes").insert({
      id: note.id,
      patient_email: note.patientEmail,
      doctor_id: note.doctorId,
      doctor_name: note.doctorName,
      kind: "evolucao",
      chief_complaint: note.chiefComplaint ?? null,
      history: note.history ?? null,
      assessment: note.assessment ?? null,
      plan: note.plan ?? null,
      shared_with_patient: note.sharedWithPatient,
      created_at: note.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("clinical_notes");
      else throw error;
    } else {
      return note;
    }
  }

  const data = await readFile();
  data.notes.push(note);
  await writeFile(data);
  return note;
}

export async function getClinicalNotes(
  email: string,
  { onlyShared = false }: { onlyShared?: boolean } = {}
): Promise<ClinicalNote[]> {
  const normalized = email.toLowerCase().trim();

  if (supabaseActive("clinical_notes")) {
    const supabase = getSupabaseAdmin()!;
    let query = supabase
      .from("clinical_notes")
      .select("*")
      .eq("patient_email", normalized)
      .order("created_at", { ascending: false });
    if (onlyShared) query = query.eq("shared_with_patient", true);
    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) missingTables.add("clinical_notes");
      else throw error;
    } else {
      return (data ?? []).map((r) => mapNoteRow(r as Record<string, unknown>));
    }
  }

  const file = await readFile();
  return file.notes
    .filter((n) => n.patientEmail === normalized && (!onlyShared || n.sharedWithPatient))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* --------------------------- Documentos (receita / exame / relatório) --------------------------- */

function mapDocumentRow(row: Record<string, unknown>): ClinicalDocument {
  return {
    id: String(row.id),
    patientEmail: String(row.patient_email),
    doctorId: String(row.doctor_id),
    doctorName: String(row.doctor_name),
    doctorCrm: (row.doctor_crm as string | null) ?? null,
    type: String(row.type) as DocumentType,
    title: String(row.title),
    body: String(row.body ?? ""),
    sharedWithPatient: Boolean(row.shared_with_patient),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function addDocument(
  input: Omit<ClinicalDocument, "id" | "createdAt">
): Promise<ClinicalDocument> {
  const doc: ClinicalDocument = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
    patientEmail: input.patientEmail.toLowerCase().trim(),
  };

  if (supabaseActive("documents")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("documents").insert({
      id: doc.id,
      patient_email: doc.patientEmail,
      doctor_id: doc.doctorId,
      doctor_name: doc.doctorName,
      doctor_crm: doc.doctorCrm ?? null,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      shared_with_patient: doc.sharedWithPatient,
      created_at: doc.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("documents");
      else throw error;
    } else {
      return doc;
    }
  }

  const data = await readFile();
  data.documents.push(doc);
  await writeFile(data);
  return doc;
}

export async function getDocuments(
  email: string,
  { onlyShared = false }: { onlyShared?: boolean } = {}
): Promise<ClinicalDocument[]> {
  const normalized = email.toLowerCase().trim();

  if (supabaseActive("documents")) {
    const supabase = getSupabaseAdmin()!;
    let query = supabase
      .from("documents")
      .select("*")
      .eq("patient_email", normalized)
      .order("created_at", { ascending: false });
    if (onlyShared) query = query.eq("shared_with_patient", true);
    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) missingTables.add("documents");
      else throw error;
    } else {
      return (data ?? []).map((r) => mapDocumentRow(r as Record<string, unknown>));
    }
  }

  const file = await readFile();
  return file.documents
    .filter((d) => d.patientEmail === normalized && (!onlyShared || d.sharedWithPatient))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* --------------------------- Exames laboratoriais --------------------------- */

export interface LabResult {
  id: string;
  patientEmail: string;
  doctorId?: string | null;
  testKey: string;
  value: number;
  unit?: string | null;
  referenceRange?: string | null;
  origin?: string | null;
  measuredAt: string;
  createdAt: string;
}

function mapLabRow(r: Record<string, unknown>): LabResult {
  return {
    id: String(r.id),
    patientEmail: String(r.patient_email),
    doctorId: (r.doctor_id as string | null) ?? null,
    testKey: String(r.test_key),
    value: Number(r.value),
    unit: (r.unit as string | null) ?? null,
    referenceRange: (r.reference_range as string | null) ?? null,
    origin: (r.origin as string | null) ?? null,
    measuredAt: new Date(String(r.measured_at)).toISOString(),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export async function addLabResult(
  input: Omit<LabResult, "id" | "createdAt">
): Promise<LabResult> {
  const row: LabResult = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
    patientEmail: input.patientEmail.toLowerCase().trim(),
  };
  if (supabaseActive("lab_results")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("lab_results").insert({
      id: row.id,
      patient_email: row.patientEmail,
      doctor_id: row.doctorId ?? null,
      test_key: row.testKey,
      value: row.value,
      unit: row.unit ?? null,
      reference_range: row.referenceRange ?? null,
      origin: row.origin ?? null,
      measured_at: row.measuredAt,
      created_at: row.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("lab_results");
      else throw error;
    } else {
      return row;
    }
  }
  const data = await readFile();
  data.labs.push(row);
  await writeFile(data);
  return row;
}

export async function getLabResults(email: string): Promise<LabResult[]> {
  const normalized = email.toLowerCase().trim();
  if (supabaseActive("lab_results")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("patient_email", normalized)
      .order("measured_at", { ascending: true });
    if (error) {
      if (isMissingTableError(error)) missingTables.add("lab_results");
      else throw error;
    } else {
      return (data ?? []).map((r) => mapLabRow(r as Record<string, unknown>));
    }
  }
  const data = await readFile();
  return data.labs
    .filter((l) => l.patientEmail === normalized)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}

/** Remove um resultado de exame (usado ao "atualizar" um exame já existente na mesma data). */
export async function deleteLabResult(id: string): Promise<void> {
  if (supabaseActive("lab_results")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("lab_results").delete().eq("id", id);
    if (error) {
      if (isMissingTableError(error)) missingTables.add("lab_results");
      else throw error;
      return;
    }
    return;
  }
  const data = await readFile();
  data.labs = data.labs.filter((l) => l.id !== id);
  await writeFile(data);
}

export async function getDocumentById(id: string): Promise<ClinicalDocument | null> {
  if (supabaseActive("documents")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) missingTables.add("documents");
      else throw error;
    } else {
      return data ? mapDocumentRow(data as Record<string, unknown>) : null;
    }
  }

  const file = await readFile();
  return file.documents.find((d) => d.id === id) ?? null;
}
