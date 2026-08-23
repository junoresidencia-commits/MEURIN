import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";

/** Aderência ao plano: por paciente e por dia, quais refeições foram cumpridas. */
export interface PlanCheckin {
  patientKey: string;
  date: string; // YYYY-MM-DD
  meals: string[]; // identificadores das refeições cumpridas (ex.: "0:Café da manhã")
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "nutrition-plan-checkins.json");
let tableMissing = false;
function activeDb() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
async function readLocal(): Promise<PlanCheckin[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as PlanCheckin[]; } catch { return []; }
}
async function writeLocal(list: PlanCheckin[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

export async function getPlanCheckin(patientKey: string, date: string): Promise<string[]> {
  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_plan_checkins").select("meals").eq("patient_key", patientKey).eq("date", date).maybeSingle();
    if (!isMissing(error) && !error) return Array.isArray(data?.meals) ? (data!.meals as string[]) : [];
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.find((c) => c.patientKey === patientKey && c.date === date)?.meals ?? [];
}

/** Marca/desmarca uma refeição do dia e devolve o conjunto atualizado. */
export async function setPlanCheckin(patientKey: string, date: string, meal: string, done: boolean): Promise<string[]> {
  const current = new Set(await getPlanCheckin(patientKey, date));
  if (done) current.add(meal); else current.delete(meal);
  const meals = Array.from(current);
  const updatedAt = new Date().toISOString();

  if (activeDb()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s
      .from("nutrition_plan_checkins")
      .upsert({ patient_key: patientKey, date, meals, updated_at: updatedAt }, { onConflict: "patient_key,date" });
    if (!isMissing(error)) { if (error) throw error; return meals; }
    tableMissing = true;
  }
  const list = await readLocal();
  const row = list.find((c) => c.patientKey === patientKey && c.date === date);
  if (row) { row.meals = meals; row.updatedAt = updatedAt; }
  else list.push({ patientKey, date, meals, updatedAt });
  await writeLocal(list);
  return meals;
}
