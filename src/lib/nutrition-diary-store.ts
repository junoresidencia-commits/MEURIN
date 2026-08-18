import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export interface NutritionTargets {
  kcal?: number | null;
  protein_g?: number | null;
  sodium_mg?: number | null;
  potassium_mg?: number | null;
  phosphorus_mg?: number | null;
  liquids_ml?: number | null;
}
export interface NutritionGoals {
  patientKey: string;
  nutritionistId?: string | null;
  nutritionistName?: string | null;
  targets: NutritionTargets;
  note?: string | null;
  updatedAt: string;
}
export interface DiaryNutrients {
  kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number;
  sodium_mg?: number; potassium_mg?: number; phosphorus_mg?: number;
}
export interface DiaryEntry {
  id: string;
  patientKey: string;
  date: string; // YYYY-MM-DD
  kind: "alimento" | "liquido";
  meal?: string | null;
  timeLabel?: string | null;
  food: string;
  grams?: number | null;
  volumeMl?: number | null;
  household?: string | null;
  nutrients: DiaryNutrients;
  note?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "nutrition-diary.json");
let tableMissing = false;
function activeDb() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
type LocalDb = { goals: NutritionGoals[]; entries: DiaryEntry[] };
async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; } catch { return { goals: [], entries: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapGoals(r: Record<string, unknown>): NutritionGoals {
  return {
    patientKey: String(r.patient_key), nutritionistId: (r.nutritionist_id as string) ?? null,
    nutritionistName: (r.nutritionist_name as string) ?? null,
    targets: (r.targets as NutritionTargets) ?? {}, note: (r.note as string) ?? null,
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}
function mapEntry(r: Record<string, unknown>): DiaryEntry {
  return {
    id: String(r.id), patientKey: String(r.patient_key), date: String(r.entry_date),
    kind: (r.kind as "alimento" | "liquido") ?? "alimento",
    meal: (r.meal as string) ?? null, timeLabel: (r.time_label as string) ?? null,
    food: String(r.food), grams: r.grams != null ? Number(r.grams) : null,
    volumeMl: r.volume_ml != null ? Number(r.volume_ml) : null, household: (r.household as string) ?? null,
    nutrients: (r.nutrients as DiaryNutrients) ?? {}, note: (r.note as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null, createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

// ---------- Goals ----------
export async function getGoals(patientKey: string): Promise<NutritionGoals | null> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_goals").select("*").eq("patient_key", patientKey).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapGoals(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.goals.find((g) => g.patientKey === patientKey) ?? null;
}

export async function setGoals(patientKey: string, input: { nutritionistId?: string | null; nutritionistName?: string | null; targets: NutritionTargets; note?: string | null }): Promise<NutritionGoals> {
  const now = new Date().toISOString();
  const goals: NutritionGoals = { patientKey, nutritionistId: input.nutritionistId ?? null, nutritionistName: input.nutritionistName ?? null, targets: input.targets, note: input.note ?? null, updatedAt: now };
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_goals").upsert(
      { patient_key: patientKey, nutritionist_id: goals.nutritionistId, nutritionist_name: goals.nutritionistName, targets: goals.targets, note: goals.note, updated_at: now },
      { onConflict: "patient_key" }
    );
    if (!isMissing(error)) { if (error) throw error; return goals; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.goals.findIndex((g) => g.patientKey === patientKey);
  if (idx >= 0) db.goals[idx] = goals; else db.goals.push(goals);
  await writeLocal(db);
  return goals;
}

// ---------- Diary ----------
export async function addDiaryEntry(input: Omit<DiaryEntry, "id" | "createdAt">): Promise<DiaryEntry> {
  const entry: DiaryEntry = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_diary_entries").insert({
      id: entry.id, patient_key: entry.patientKey, entry_date: entry.date, kind: entry.kind,
      meal: entry.meal, time_label: entry.timeLabel, food: entry.food, grams: entry.grams, volume_ml: entry.volumeMl,
      household: entry.household, nutrients: entry.nutrients, note: entry.note, photo_url: entry.photoUrl, created_at: entry.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return entry; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.entries.push(entry);
  await writeLocal(db);
  return entry;
}

export async function listDiary(patientKey: string, date?: string): Promise<DiaryEntry[]> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("nutrition_diary_entries").select("*").eq("patient_key", patientKey);
    if (date) q = q.eq("entry_date", date);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (!isMissing(error) && !error) return (data ?? []).map(mapEntry);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.entries.filter((e) => e.patientKey === patientKey && (!date || e.date === date)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteDiaryEntry(id: string, patientKey: string): Promise<void> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_diary_entries").delete().eq("id", id).eq("patient_key", patientKey);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.entries = db.entries.filter((e) => !(e.id === id && e.patientKey === patientKey));
  await writeLocal(db);
}
