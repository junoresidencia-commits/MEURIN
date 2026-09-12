import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";
import { readDb } from "./store";
import { countPlatformRows } from "./platform-store";
import type { IntegrityCounts } from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");

async function countJsonArray(file: string, key?: string): Promise<number> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8"));
    if (key) return Array.isArray(raw[key]) ? raw[key].length : 0;
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

async function supabaseCount(table: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

/** Contagens somente-leitura. Nunca altera registros. */
export async function collectIntegrityCounts(): Promise<IntegrityCounts> {
  const db = await readDb();
  const platform = await countPlatformRows();
  const sbPatients = await supabaseCount("patients");
  const sbNotes = await supabaseCount("clinical_notes");
  const sbDocs = await supabaseCount("documents");
  const sbLabs = await supabaseCount("lab_results");

  return {
    doctors: db.doctors.length,
    patients: sbPatients ?? (await countJsonArray("patients.json")),
    bookings: db.bookings.length,
    clinicalNotes: sbNotes ?? (await countJsonArray("patient-records.json", "notes")),
    documents: sbDocs ?? (await countJsonArray("patient-records.json", "documents")),
    labResults: sbLabs ?? (await countJsonArray("patient-records.json", "labs")),
    clinics: platform.clinics,
    memberships: platform.memberships,
    roleAssignments: platform.roleAssignments,
  };
}

export function countsDropped(before: IntegrityCounts, after: IntegrityCounts): string[] {
  const keys: (keyof IntegrityCounts)[] = [
    "doctors",
    "patients",
    "bookings",
    "clinicalNotes",
    "documents",
    "labResults",
  ];
  return keys.filter((k) => after[k] < before[k]).map((k) => `${k}: ${before[k]} → ${after[k]}`);
}
