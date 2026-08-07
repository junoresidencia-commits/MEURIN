import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export interface Patient {
  id: string;
  doctorId: string;
  name: string;
  cpf?: string | null;
  birthdate?: string | null;
  sex?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  insurance?: string | null;
  allergies?: string | null;
  diseases?: string | null;
  medications?: string | null;
  notes?: string | null;
  status: "active" | "archived";
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "patients.json");
let tableMissing = false;

function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
export function normalizeCpf(cpf?: string | null): string {
  return String(cpf || "").replace(/\D/g, "");
}

async function readFile(): Promise<Patient[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Patient[];
  } catch {
    return [];
  }
}
async function writeFile(list: Patient[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): Patient {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    name: String(r.name),
    cpf: (r.cpf as string | null) ?? null,
    birthdate: r.birthdate ? String(r.birthdate) : null,
    sex: (r.sex as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    emergencyContact: (r.emergency_contact as string | null) ?? null,
    guardianName: (r.guardian_name as string | null) ?? null,
    guardianPhone: (r.guardian_phone as string | null) ?? null,
    insurance: (r.insurance as string | null) ?? null,
    allergies: (r.allergies as string | null) ?? null,
    diseases: (r.diseases as string | null) ?? null,
    medications: (r.medications as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    status: (String(r.status || "active") as Patient["status"]),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

/** Chave estável usada nas tabelas clínicas (notes/documents) para este paciente. */
export function clinicalKey(p: Patient): string {
  return p.email ? p.email.toLowerCase().trim() : `pid:${p.id}`;
}

export type NewPatient = Omit<Patient, "id" | "createdAt" | "status"> & {
  status?: Patient["status"];
};

export async function findByCpf(doctorId: string, cpf: string): Promise<Patient | null> {
  const norm = normalizeCpf(cpf);
  if (!norm) return null;
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("cpf_normalized", norm)
      .limit(1);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return data && data[0] ? mapRow(data[0] as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  return list.find((p) => normalizeCpf(p.cpf) === norm) ?? null;
}

export async function createPatient(input: NewPatient): Promise<Patient> {
  const p: Patient = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    status: input.status || "active",
    ...input,
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("patients").insert({
      id: p.id,
      doctor_id: p.doctorId,
      name: p.name,
      cpf: p.cpf ?? null,
      cpf_normalized: normalizeCpf(p.cpf),
      birthdate: p.birthdate || null,
      sex: p.sex ?? null,
      phone: p.phone ?? null,
      email: p.email ? p.email.toLowerCase().trim() : null,
      address: p.address ?? null,
      emergency_contact: p.emergencyContact ?? null,
      guardian_name: p.guardianName ?? null,
      guardian_phone: p.guardianPhone ?? null,
      insurance: p.insurance ?? null,
      allergies: p.allergies ?? null,
      diseases: p.diseases ?? null,
      medications: p.medications ?? null,
      notes: p.notes ?? null,
      status: p.status,
      created_at: p.createdAt,
    });
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return p;
    }
  }
  const list = await readFile();
  list.push(p);
  await writeFile(list);
  return p;
}

export async function listPatientsByDoctor(doctorId: string): Promise<Patient[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list.filter((p) => p.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Exclui um paciente criado pelo médico. Só remove se pertencer ao próprio médico. */
export async function deletePatient(id: string, doctorId: string): Promise<boolean> {
  const patient = await getPatient(id);
  if (!patient || patient.doctorId !== doctorId) return false;
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("patients").delete().eq("id", id).eq("doctor_id", doctorId);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return true;
    }
  }
  const list = await readFile();
  await writeFile(list.filter((p) => p.id !== id));
  return true;
}

export async function getPatient(id: string): Promise<Patient | null> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return data ? mapRow(data as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  return list.find((p) => p.id === id) ?? null;
}
