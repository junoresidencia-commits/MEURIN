import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";
import type { ClinicalProfileData } from "./clinical-fields";

export interface ClinicalProfile {
  patientKey: string;
  doctorId?: string | null;
  data: ClinicalProfileData;
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
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
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
  return list.find((p) => p.patientKey === key) ?? null;
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
  return list.filter((p) => p.doctorId === doctorId);
}

export async function saveProfile(input: {
  patientKey: string;
  doctorId?: string | null;
  data: ClinicalProfileData;
  updatedBy?: string | null;
}): Promise<ClinicalProfile> {
  const key = input.patientKey.toLowerCase().trim();
  const row: ClinicalProfile = {
    patientKey: key,
    doctorId: input.doctorId ?? null,
    data: input.data || {},
    updatedBy: input.updatedBy ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("patient_clinical_profile").upsert(
      {
        patient_key: row.patientKey,
        doctor_id: row.doctorId,
        data: row.data,
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
  const idx = list.findIndex((p) => p.patientKey === key);
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  await writeFile(list);
  return row;
}
