import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SignatureSession } from "./types";
import { makeIdempotencyKey } from "./idempotency";

export { makeIdempotencyKey };

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "document-workflow.json");
const TABLE = "document_signature_sessions";

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

type FileShape = { sessions: SignatureSession[] };

async function readFile(): Promise<FileShape> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as FileShape;
  } catch {
    return { sessions: [] };
  }
}
async function writeFile(data: FileShape) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

function mapRow(r: Record<string, unknown>): SignatureSession {
  return {
    id: String(r.id),
    documentId: (r.document_id as string) || null,
    patientKey: String(r.patient_key || ""),
    doctorId: String(r.doctor_id || ""),
    provider: (r.provider as SignatureSession["provider"]) || "none",
    method: (r.method as SignatureSession["method"]) || "DIGITAL",
    status: (r.status as SignatureSession["status"]) || "started",
    originalHash: (r.original_hash as string) || null,
    startedAt: String(r.started_at || r.created_at || ""),
    completedAt: (r.completed_at as string) || null,
    expiresAt: (r.expires_at as string) || null,
    providerReference: (r.provider_reference as string) || null,
    errorCode: (r.error_code as string) || null,
    errorMessageSanitized: (r.error_message as string) || null,
    idempotencyKey: String(r.idempotency_key || r.id),
  };
}

export async function getOpenSession(opts: {
  documentId?: string | null;
  doctorId: string;
  method?: string;
}): Promise<SignatureSession | null> {
  const list = await listSessionsForDoctor(opts.doctorId);
  return (
    list.find(
      (s) =>
        (opts.documentId ? s.documentId === opts.documentId : true) &&
        (opts.method ? s.method === opts.method : true) &&
        (s.status === "started" || s.status === "awaiting_upload"),
    ) || null
  );
}

export async function listSessionsForDoctor(doctorId: string): Promise<SignatureSession[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from(TABLE).select("*").eq("doctor_id", doctorId).order("started_at", { ascending: false }).limit(200);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data || []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const file = await readFile();
  return file.sessions.filter((s) => s.doctorId === doctorId);
}

export async function listSessionsForPatient(patientKey: string): Promise<SignatureSession[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from(TABLE).select("*").eq("patient_key", patientKey).order("started_at", { ascending: false }).limit(200);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data || []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const file = await readFile();
  return file.sessions.filter((s) => s.patientKey === patientKey);
}

export async function upsertSession(input: Omit<SignatureSession, "id" | "startedAt"> & { id?: string; startedAt?: string }): Promise<SignatureSession> {
  const now = new Date().toISOString();
  const existing = await getOpenSession({
    documentId: input.documentId,
    doctorId: input.doctorId,
    method: input.method,
  });
  if (existing && input.status !== "completed") {
    return existing;
  }
  const row: SignatureSession = {
    id: input.id || uuid(),
    documentId: input.documentId,
    patientKey: input.patientKey,
    doctorId: input.doctorId,
    provider: input.provider,
    method: input.method,
    status: input.status,
    originalHash: input.originalHash ?? null,
    startedAt: input.startedAt || now,
    completedAt: input.completedAt ?? null,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    providerReference: input.providerReference ?? null,
    errorCode: input.errorCode ?? null,
    errorMessageSanitized: input.errorMessageSanitized ?? null,
    idempotencyKey: input.idempotencyKey,
  };

  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from(TABLE).upsert({
      id: row.id,
      document_id: row.documentId,
      patient_key: row.patientKey,
      doctor_id: row.doctorId,
      provider: row.provider,
      method: row.method,
      status: row.status,
      original_hash: row.originalHash,
      started_at: row.startedAt,
      completed_at: row.completedAt,
      expires_at: row.expiresAt,
      provider_reference: row.providerReference,
      error_code: row.errorCode,
      error_message: row.errorMessageSanitized,
      idempotency_key: row.idempotencyKey,
    });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return row;
    }
  }
  const file = await readFile();
  const idx = file.sessions.findIndex((s) => s.id === row.id || s.idempotencyKey === row.idempotencyKey);
  if (idx >= 0) file.sessions[idx] = { ...file.sessions[idx], ...row };
  else file.sessions.push(row);
  await writeFile(file);
  return row;
}

export async function completeSession(id: string, patch: Partial<SignatureSession>): Promise<SignatureSession | null> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: patch.status || "completed",
        completed_at: patch.completedAt || new Date().toISOString(),
        error_code: patch.errorCode ?? null,
        error_message: patch.errorMessageSanitized ?? null,
        provider_reference: patch.providerReference ?? null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else if (data) {
      return mapRow(data as Record<string, unknown>);
    }
  }
  const file = await readFile();
  const idx = file.sessions.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  file.sessions[idx] = {
    ...file.sessions[idx],
    ...patch,
    status: patch.status || "completed",
    completedAt: patch.completedAt || new Date().toISOString(),
  };
  await writeFile(file);
  return file.sessions[idx];
}
