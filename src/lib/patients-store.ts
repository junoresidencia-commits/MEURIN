import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";

/** Senha inicial padrão do paciente (login por CPF). Trocável depois. */
export const DEFAULT_PATIENT_PASSWORD = "123456";

export interface Patient {
  id: string;
  doctorId: string;
  name: string;
  cpf?: string | null;
  cns?: string | null;
  motherName?: string | null;
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
  passwordHash?: string | null;
  mustChangePassword?: boolean;
  status: "active" | "archived";
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "patients.json");
let tableMissing = false;

function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  // Apenas TABELA ausente aciona o fallback local. Coluna ausente (PGRST204/42703)
  // é erro real (migração incompleta) — não deve cair no fallback (que, na Vercel,
  // tentaria escrever em disco somente-leitura e quebraria o cadastro).
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return Boolean(e.message && /relation .* does not exist|could not find the table/i.test(e.message));
}
function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}

/** Detecta a coluna ausente numa mensagem do PostgREST (migração incompleta). */
function missingColumnName(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code !== "PGRST204" && error.code !== "42703" && !/column|schema cache/i.test(error.message || "")) return null;
  const msg = error.message || "";
  let m = msg.match(/find the '([^']+)' column/i);
  if (m) return m[1];
  m = msg.match(/column "?([a-z0-9_]+)"? .*does not exist/i);
  if (m) return m[1];
  return null;
}

/** Insere tolerando colunas ausentes: remove a coluna faltante e tenta de novo,
 * para o cadastro não quebrar quando uma migração ainda não foi aplicada. */
async function insertPatientResilient(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }> {
  const supabase = getSupabaseAdmin()!;
  const current = { ...row };
  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from("patients").insert(current);
    if (!error) return { error: null };
    const col = missingColumnName(error);
    if (!col || !(col in current)) return { error };
    delete current[col];
  }
  return await supabase.from("patients").insert(current);
}
export function normalizeCpf(cpf?: string | null): string {
  return String(cpf || "").replace(/\D/g, "");
}

/** Mascara o nome para exibir no fluxo de vínculo por CPF. */
export function maskPatientName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => (p.length <= 1 ? "*" : `${p[0]}${"*".repeat(Math.min(4, p.length - 1))}`))
    .join(" ");
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
    cns: (r.cns as string | null) ?? null,
    motherName: (r.mother_name as string | null) ?? null,
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
    passwordHash: (r.password_hash as string | null) ?? null,
    mustChangePassword: r.must_change_password === true,
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
  // Sem senha própria informada => usa a provisória 123456 e exige troca no 1º acesso.
  const usedDefault = !input.passwordHash;
  const passwordHash = input.passwordHash || (await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, 10));
  const mustChangePassword = input.mustChangePassword ?? usedDefault;
  const p: Patient = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    status: input.status || "active",
    ...input,
    passwordHash,
    mustChangePassword,
  };
  if (active()) {
    const { error } = await insertPatientResilient({
      id: p.id,
      doctor_id: p.doctorId,
      name: p.name,
      cpf: p.cpf ?? null,
      cpf_normalized: normalizeCpf(p.cpf),
      cns: p.cns ?? null,
      mother_name: p.motherName ?? null,
      birthdate: p.birthdate || null,
      sex: p.sex ?? null,
      phone: p.phone ?? null,
      email: p.email ? p.email.toLowerCase().trim() : null,
      address: p.address ?? null,
      emergency_contact: p.emergencyContact ?? null,
      guardian_name: p.guardianName ?? null,
      guardian_phone: p.guardianPhone ?? null,
      must_change_password: p.mustChangePassword ?? false,
      insurance: p.insurance ?? null,
      allergies: p.allergies ?? null,
      diseases: p.diseases ?? null,
      medications: p.medications ?? null,
      notes: p.notes ?? null,
      password_hash: p.passwordHash ?? null,
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

/** Atualiza dados cadastrais do paciente (usado na edição "Meus dados" e vínculo médico↔CPF). */
export async function updatePatient(
  id: string,
  patch: Partial<
    Pick<Patient, "name" | "phone" | "email" | "birthdate" | "sex" | "address" | "doctorId" | "passwordHash" | "cns" | "motherName">
  >
): Promise<Patient | null> {
  const current = await getPatient(id);
  if (!current) return null;
  const updated: Patient = {
    ...current,
    ...patch,
    email: patch.email !== undefined ? (patch.email ? patch.email.toLowerCase().trim() : null) : current.email,
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const row: Record<string, unknown> = {
      name: updated.name,
      phone: updated.phone ?? null,
      email: updated.email ?? null,
      birthdate: updated.birthdate || null,
      sex: updated.sex ?? null,
      address: updated.address ?? null,
    };
    if (patch.cns !== undefined) row.cns = updated.cns ?? null;
    if (patch.motherName !== undefined) row.mother_name = updated.motherName ?? null;
    if (patch.doctorId !== undefined) row.doctor_id = updated.doctorId;
    if (patch.passwordHash !== undefined) row.password_hash = updated.passwordHash ?? null;
    const { error } = await supabase
      .from("patients")
      .update(row)
      .eq("id", id);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return updated;
    }
  }
  const list = await readFile();
  await writeFile(list.map((p) => (p.id === id ? updated : p)));
  return updated;
}

/** Busca um paciente por CPF (qualquer médico) — usado no login por CPF. */
export async function findByCpfAny(cpf: string): Promise<Patient | null> {
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

/** Busca um paciente criado pelo médico por e-mail — usado na troca de senha. */
export async function findByEmailAny(email: string): Promise<Patient | null> {
  const norm = email.toLowerCase().trim();
  if (!norm) return null;
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("patients").select("*").eq("email", norm).limit(1);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return data && data[0] ? mapRow(data[0] as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  return list.find((p) => (p.email || "").toLowerCase().trim() === norm) ?? null;
}

/** Confere a senha do paciente (fallback para a senha padrão em cadastros antigos). */
export async function verifyPatientPassword(patient: Patient, password: string): Promise<boolean> {
  if (patient.passwordHash) return bcrypt.compare(password, patient.passwordHash);
  return password === DEFAULT_PATIENT_PASSWORD;
}

/** Atualiza a senha do paciente e limpa a exigência de troca (1º acesso concluído). */
export async function setPatientPassword(id: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 10);
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    // Tenta limpar também o flag; se a coluna não existir, faz só a senha.
    let { error } = await supabase.from("patients").update({ password_hash: hash, must_change_password: false }).eq("id", id);
    if (error && (error.code === "PGRST204" || /must_change_password|column|schema cache/i.test(error.message || ""))) {
      ({ error } = await supabase.from("patients").update({ password_hash: hash }).eq("id", id));
    }
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return;
    }
  }
  const list = await readFile();
  await writeFile(list.map((p) => (p.id === id ? { ...p, passwordHash: hash, mustChangePassword: false } : p)));
}

/** Redefine o acesso do paciente para a senha provisória 123456 e exige troca no próximo login. */
export async function resetPatientAccess(id: string): Promise<void> {
  const hash = await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, 10);
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    let { error } = await supabase.from("patients").update({ password_hash: hash, must_change_password: true }).eq("id", id);
    if (error && (error.code === "PGRST204" || /must_change_password|column|schema cache/i.test(error.message || ""))) {
      ({ error } = await supabase.from("patients").update({ password_hash: hash }).eq("id", id));
    }
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return;
    }
  }
  const list = await readFile();
  await writeFile(list.map((p) => (p.id === id ? { ...p, passwordHash: hash, mustChangePassword: true } : p)));
}
