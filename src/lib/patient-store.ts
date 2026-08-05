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

export interface PatientData {
  records: HomeRecord[];
  food: FoodLog[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "patient-records.json");

/** True while the Supabase tables are missing, so we stay on the JSON fallback. */
let supabaseTablesMissing = false;

function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}

function supabaseActive() {
  return Boolean(getSupabaseAdmin()) && !supabaseTablesMissing;
}

/* --------------------------- JSON fallback --------------------------- */

async function readFile(): Promise<PatientData> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as PatientData;
    return { records: parsed.records ?? [], food: parsed.food ?? [] };
  } catch {
    return { records: [], food: [] };
  }
}

async function writeFile(data: PatientData): Promise<void> {
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

  if (supabaseActive()) {
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
        supabaseTablesMissing = true;
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

  if (supabaseActive()) {
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
        supabaseTablesMissing = true;
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

  if (supabaseActive()) {
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
      supabaseTablesMissing = true;
    } else if (recordsRes.error) {
      throw recordsRes.error;
    } else if (foodRes.error && isMissingTableError(foodRes.error)) {
      supabaseTablesMissing = true;
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
