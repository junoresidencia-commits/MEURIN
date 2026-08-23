import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export interface LmeMedication {
  name: string;
  presentation?: string;
  monthlyQty?: string;
}

export interface LmeRequest {
  id: string;
  patientEmail: string;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  doctorCns?: string | null;
  establishmentName?: string | null;
  cnes?: string | null;
  patientName?: string | null;
  motherName?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  patientCpf?: string | null;
  patientCns?: string | null;
  patientPhone?: string | null;
  patientEmailContact?: string | null;
  race?: string | null;
  cid10?: string | null;
  diagnosis?: string | null;
  anamnesis?: string | null;
  priorTreatment: boolean;
  priorTreatmentDesc?: string | null;
  incapable: boolean;
  responsibleName?: string | null;
  medications: LmeMedication[];
  status: string;
  /** Preenchido quando o médico marca a LME como assinada (à mão ou digital). */
  signedAt?: string | null;
  signedBy?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "lme.json");
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

async function readFile(): Promise<LmeRequest[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LmeRequest[];
  } catch {
    return [];
  }
}
async function writeFile(list: LmeRequest[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): LmeRequest {
  return {
    id: String(r.id),
    patientEmail: String(r.patient_email),
    doctorId: (r.doctor_id as string | null) ?? null,
    doctorName: (r.doctor_name as string | null) ?? null,
    doctorCrm: (r.doctor_crm as string | null) ?? null,
    doctorCns: (r.doctor_cns as string | null) ?? null,
    establishmentName: (r.establishment_name as string | null) ?? null,
    cnes: (r.cnes as string | null) ?? null,
    patientName: (r.patient_name as string | null) ?? null,
    motherName: (r.mother_name as string | null) ?? null,
    weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
    heightCm: r.height_cm == null ? null : Number(r.height_cm),
    patientCpf: (r.patient_cpf as string | null) ?? null,
    patientCns: (r.patient_cns as string | null) ?? null,
    patientPhone: (r.patient_phone as string | null) ?? null,
    patientEmailContact: (r.patient_email_contact as string | null) ?? null,
    race: (r.race as string | null) ?? null,
    cid10: (r.cid10 as string | null) ?? null,
    diagnosis: (r.diagnosis as string | null) ?? null,
    anamnesis: (r.anamnesis as string | null) ?? null,
    priorTreatment: Boolean(r.prior_treatment),
    priorTreatmentDesc: (r.prior_treatment_desc as string | null) ?? null,
    incapable: Boolean(r.incapable),
    responsibleName: (r.responsible_name as string | null) ?? null,
    medications: Array.isArray(r.medications) ? (r.medications as LmeMedication[]) : [],
    status: String(r.status || "rascunho"),
    signedAt: r.signed_at ? new Date(String(r.signed_at)).toISOString() : null,
    signedBy: (r.signed_by as string | null) ?? null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export async function createLme(input: Omit<LmeRequest, "id" | "createdAt">): Promise<LmeRequest> {
  const row: LmeRequest = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...input,
    patientEmail: input.patientEmail.toLowerCase().trim(),
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("lme_requests").insert({
      id: row.id,
      patient_email: row.patientEmail,
      doctor_id: row.doctorId ?? null,
      doctor_name: row.doctorName ?? null,
      doctor_crm: row.doctorCrm ?? null,
      doctor_cns: row.doctorCns ?? null,
      establishment_name: row.establishmentName ?? null,
      cnes: row.cnes ?? null,
      patient_name: row.patientName ?? null,
      mother_name: row.motherName ?? null,
      weight_kg: row.weightKg ?? null,
      height_cm: row.heightCm ?? null,
      patient_cpf: row.patientCpf ?? null,
      patient_cns: row.patientCns ?? null,
      patient_phone: row.patientPhone ?? null,
      patient_email_contact: row.patientEmailContact ?? null,
      race: row.race ?? null,
      cid10: row.cid10 ?? null,
      diagnosis: row.diagnosis ?? null,
      anamnesis: row.anamnesis ?? null,
      prior_treatment: row.priorTreatment,
      prior_treatment_desc: row.priorTreatmentDesc ?? null,
      incapable: row.incapable,
      responsible_name: row.responsibleName ?? null,
      medications: row.medications,
      status: row.status,
      created_at: row.createdAt,
    });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return row;
    }
  }
  const list = await readFile();
  list.push(row);
  await writeFile(list);
  return row;
}

export async function listLme(email: string): Promise<LmeRequest[]> {
  const normalized = email.toLowerCase().trim();
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("lme_requests")
      .select("*")
      .eq("patient_email", normalized)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list.filter((l) => l.patientEmail === normalized).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Lista as LME de um médico (para "LME para assinar" e a lista de LME). */
export async function listLmeByDoctor(doctorId: string): Promise<LmeRequest[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("lme_requests")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list.filter((l) => l.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Marca uma LME como assinada (ou desfaz). Retorna a LME atualizada ou null. */
export async function markLmeSigned(id: string, signed: boolean, by?: string | null): Promise<LmeRequest | null> {
  const signedAt = signed ? new Date().toISOString() : null;
  const signedBy = signed ? (by ?? null) : null;
  const status = signed ? "assinada" : "rascunho";
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("lme_requests").update({ signed_at: signedAt, signed_by: signedBy, status }).eq("id", id);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return getLme(id);
    }
  }
  const list = await readFile();
  const idx = list.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], signedAt, signedBy, status };
  await writeFile(list);
  return list[idx];
}

/** Exclui uma LME (registro). Não afeta o PDF oficial em /public. */
export async function deleteLme(id: string): Promise<void> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("lme_requests").delete().eq("id", id);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
      return;
    }
    return;
  }
  const list = await readFile();
  await writeFile(list.filter((l) => l.id !== id));
}

export async function getLme(id: string): Promise<LmeRequest | null> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("lme_requests").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return data ? mapRow(data as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  return list.find((l) => l.id === id) ?? null;
}
