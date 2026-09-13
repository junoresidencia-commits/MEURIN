import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";
import { countBookings, listDoctors } from "./store";
import { countPlatformRows } from "./platform-store";
import { countSaasRows } from "./saas-store";
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
  const [doctors, bookings, platform, saas, sbPatients, sbNotes, sbDocs, sbLabs] = await Promise.all([
    listDoctors(),
    countBookings(),
    countPlatformRows(),
    countSaasRows(),
    supabaseCount("patients"),
    supabaseCount("clinical_notes"),
    supabaseCount("documents"),
    supabaseCount("lab_results"),
  ]);

  return {
    doctors: doctors.length,
    patients: sbPatients ?? (await countJsonArray("patients.json")),
    bookings,
    clinicalNotes: sbNotes ?? (await countJsonArray("patient-records.json", "notes")),
    documents: sbDocs ?? (await countJsonArray("patient-records.json", "documents")),
    labResults: sbLabs ?? (await countJsonArray("patient-records.json", "labs")),
    clinics: platform.clinics,
    memberships: platform.memberships,
    roleAssignments: platform.roleAssignments,
    saasPlans: saas.saasPlans,
    saasLicenses: saas.saasLicenses,
  };
}

export type IntegritySnapshot = {
  label: string;
  counts: IntegrityCounts;
  createdAt: string;
};

export async function latestIntegritySnapshot(): Promise<IntegritySnapshot | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb
      .from("platform_integrity_snapshots")
      .select("label,counts,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      label: String((data as { label: string }).label),
      counts: (data as { counts: IntegrityCounts }).counts,
      createdAt: String((data as { created_at: string }).created_at),
    };
  }
  return null;
}

export async function saveIntegritySnapshot(label: string, counts: IntegrityCounts): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from("platform_integrity_snapshots").insert({
    label,
    counts,
  });
  if (error) console.error("[integrity] snapshot ignorado", error);
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
