import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabase-admin";

/**
 * Atendimento em andamento e retornos programados.
 * Fonte única para "Iniciar/Finalizar atendimento", "Continuar de onde parou"
 * e a Central de Retornos. Não substitui a Agenda (bookings) — apenas registra
 * o ciclo do atendimento e o próximo retorno definido pelo médico.
 *
 * Persistência: tabelas Supabase `care_attendance` e `care_returns` quando
 * disponíveis; caso contrário, arquivo local `data/care.json` (dev). Resiliente
 * a tabela ausente (cai para o arquivo local sem quebrar).
 */

export interface Attendance {
  id: string;
  doctorId: string;
  patientKey: string;
  bookingId?: string | null;
  patientName?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
}

export interface CareReturn {
  id: string;
  doctorId: string;
  patientKey: string;
  patientName?: string | null;
  dueAt: string; // ISO
  intervalLabel?: string | null;
  sourceBookingId?: string | null;
  status: "open" | "done" | "cancelled";
  createdBy?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "care.json");
const missing = new Set<string>();

function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST204") return true;
  return Boolean(e.message && /does not exist|could not find the table|schema cache/i.test(e.message));
}
function active(table: string) {
  return Boolean(getSupabaseAdmin()) && !missing.has(table);
}

type CareFile = { attendance: Attendance[]; returns: CareReturn[] };
async function readFile(): Promise<CareFile> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
    return { attendance: raw.attendance || [], returns: raw.returns || [] };
  } catch {
    return { attendance: [], returns: [] };
  }
}
async function writeFile(data: CareFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

function mapAttendance(r: Record<string, unknown>): Attendance {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    patientKey: String(r.patient_key),
    bookingId: (r.booking_id as string | null) ?? null,
    patientName: (r.patient_name as string | null) ?? null,
    startedAt: new Date(String(r.started_at)).toISOString(),
    finishedAt: r.finished_at ? new Date(String(r.finished_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}
function mapReturn(r: Record<string, unknown>): CareReturn {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    patientKey: String(r.patient_key),
    patientName: (r.patient_name as string | null) ?? null,
    dueAt: new Date(String(r.due_at)).toISOString(),
    intervalLabel: (r.interval_label as string | null) ?? null,
    sourceBookingId: (r.source_booking_id as string | null) ?? null,
    status: (String(r.status) as CareReturn["status"]) || "open",
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

/* ------------------------------- Atendimento ------------------------------- */

/** Inicia (ou retoma) um atendimento em andamento para o paciente. */
export async function startAttendance(input: { doctorId: string; patientKey: string; bookingId?: string | null; patientName?: string | null }): Promise<Attendance> {
  const existing = await getOpenAttendanceForPatient(input.doctorId, input.patientKey);
  if (existing) return existing;
  const row: Attendance = {
    id: randomUUID(),
    doctorId: input.doctorId,
    patientKey: input.patientKey.toLowerCase().trim(),
    bookingId: input.bookingId ?? null,
    patientName: input.patientName ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (active("care_attendance")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("care_attendance").insert({
      id: row.id, doctor_id: row.doctorId, patient_key: row.patientKey, booking_id: row.bookingId,
      patient_name: row.patientName, started_at: row.startedAt, finished_at: null, created_at: row.createdAt,
    });
    if (error) { if (isMissing(error)) missing.add("care_attendance"); else throw error; }
    else return row;
  }
  const data = await readFile();
  data.attendance.push(row);
  await writeFile(data);
  return row;
}

export async function getOpenAttendanceForPatient(doctorId: string, patientKey: string): Promise<Attendance | null> {
  const key = patientKey.toLowerCase().trim();
  const all = await listAttendance(doctorId);
  return all.find((a) => a.patientKey === key && !a.finishedAt) || null;
}

/** Atendimentos em andamento (não finalizados) do médico, mais recente primeiro. */
export async function listOpenAttendance(doctorId: string): Promise<Attendance[]> {
  const all = await listAttendance(doctorId);
  return all.filter((a) => !a.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

async function listAttendance(doctorId: string): Promise<Attendance[]> {
  if (active("care_attendance")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("care_attendance").select("*").eq("doctor_id", doctorId);
    if (error) { if (isMissing(error)) missing.add("care_attendance"); else throw error; }
    else return (data ?? []).map((r) => mapAttendance(r as Record<string, unknown>));
  }
  const data = await readFile();
  return data.attendance.filter((a) => a.doctorId === doctorId);
}

export async function finishAttendance(input: { doctorId: string; patientKey: string; bookingId?: string | null }): Promise<void> {
  const key = input.patientKey.toLowerCase().trim();
  const finishedAt = new Date().toISOString();
  if (active("care_attendance")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("care_attendance").update({ finished_at: finishedAt })
      .eq("doctor_id", input.doctorId).eq("patient_key", key).is("finished_at", null);
    if (error) { if (isMissing(error)) missing.add("care_attendance"); else throw error; }
    else return;
  }
  const data = await readFile();
  for (const a of data.attendance) {
    if (a.doctorId === input.doctorId && a.patientKey === key && !a.finishedAt) a.finishedAt = finishedAt;
  }
  await writeFile(data);
}

/* --------------------------------- Retornos -------------------------------- */

/** Cria um retorno programado, fechando retornos abertos anteriores do mesmo paciente. */
export async function createReturn(input: { doctorId: string; patientKey: string; dueAt: string; intervalLabel?: string | null; sourceBookingId?: string | null; patientName?: string | null; createdBy?: string | null }): Promise<CareReturn> {
  const key = input.patientKey.toLowerCase().trim();
  await closeOpenReturns(input.doctorId, key);
  const row: CareReturn = {
    id: randomUUID(),
    doctorId: input.doctorId,
    patientKey: key,
    patientName: input.patientName ?? null,
    dueAt: new Date(input.dueAt).toISOString(),
    intervalLabel: input.intervalLabel ?? null,
    sourceBookingId: input.sourceBookingId ?? null,
    status: "open",
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
  };
  if (active("care_returns")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("care_returns").insert({
      id: row.id, doctor_id: row.doctorId, patient_key: row.patientKey, patient_name: row.patientName,
      due_at: row.dueAt, interval_label: row.intervalLabel, source_booking_id: row.sourceBookingId,
      status: row.status, created_by: row.createdBy, created_at: row.createdAt,
    });
    if (error) { if (isMissing(error)) missing.add("care_returns"); else throw error; }
    else return row;
  }
  const data = await readFile();
  data.returns.push(row);
  await writeFile(data);
  return row;
}

async function closeOpenReturns(doctorId: string, patientKey: string): Promise<void> {
  if (active("care_returns")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("care_returns").update({ status: "done" })
      .eq("doctor_id", doctorId).eq("patient_key", patientKey).eq("status", "open");
    if (error) { if (isMissing(error)) missing.add("care_returns"); else throw error; }
    else return;
  }
  const data = await readFile();
  for (const r of data.returns) {
    if (r.doctorId === doctorId && r.patientKey === patientKey && r.status === "open") r.status = "done";
  }
  await writeFile(data);
}

export async function listReturnsByDoctor(doctorId: string, status: CareReturn["status"] | "all" = "open"): Promise<CareReturn[]> {
  let rows: CareReturn[];
  if (active("care_returns")) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("care_returns").select("*").eq("doctor_id", doctorId);
    if (error) { if (isMissing(error)) missing.add("care_returns"); else throw error; rows = []; }
    else rows = (data ?? []).map((r) => mapReturn(r as Record<string, unknown>));
  } else {
    const data = await readFile();
    rows = data.returns.filter((r) => r.doctorId === doctorId);
  }
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function setReturnStatus(id: string, status: CareReturn["status"], doctorId: string): Promise<void> {
  if (active("care_returns")) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("care_returns").update({ status }).eq("id", id).eq("doctor_id", doctorId);
    if (error) { if (isMissing(error)) missing.add("care_returns"); else throw error; }
    else return;
  }
  const data = await readFile();
  for (const r of data.returns) if (r.id === id && r.doctorId === doctorId) r.status = status;
  await writeFile(data);
}
