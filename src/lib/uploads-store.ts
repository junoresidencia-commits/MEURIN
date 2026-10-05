import "server-only";
import { v4 as uuid } from "uuid";
import { EXAM_MAX_BYTES } from "./patient-exam-file";
import { getSupabaseAdmin } from "./supabase-admin";

export const EXAMES_BUCKET = "exames";

let bucketReady = false;
async function ensureExamBucket() {
  const supabase = getSupabaseAdmin();
  if (!supabase || bucketReady) return;
  try {
    const { data } = await supabase.storage.getBucket(EXAMES_BUCKET);
    if (!data) {
      await supabase.storage.createBucket(EXAMES_BUCKET, {
        public: false,
        fileSizeLimit: EXAM_MAX_BYTES,
      });
    } else if (!data.file_size_limit || data.file_size_limit < EXAM_MAX_BYTES) {
      await supabase.storage.updateBucket(EXAMES_BUCKET, { fileSizeLimit: EXAM_MAX_BYTES });
    }
  } catch {
    try {
      await supabase.storage.createBucket(EXAMES_BUCKET, {
        public: false,
        fileSizeLimit: EXAM_MAX_BYTES,
      });
    } catch {
      /* já existe */
    }
  }
  bucketReady = true;
}

function examObjectPath(email: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "arquivo";
  return `${email.toLowerCase().trim()}/${uuid()}-${safe}`;
}

export interface PatientUpload {
  id: string;
  patientEmail: string;
  uploader: string;
  name: string;
  category?: string | null;
  filePath: string;
  mime?: string | null;
  sizeBytes?: number | null;
  examDate?: string | null;
  createdAt: string;
  signedUrl?: string | null;
}

function mapRow(r: Record<string, unknown>): PatientUpload {
  return {
    id: String(r.id),
    patientEmail: String(r.patient_email),
    uploader: String(r.uploader || "patient"),
    name: String(r.name),
    category: (r.category as string | null) ?? null,
    filePath: String(r.file_path),
    mime: (r.mime as string | null) ?? null,
    sizeBytes: (r.size_bytes as number | null) ?? null,
    examDate: r.exam_date ? String(r.exam_date) : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export function storageAvailable(): boolean {
  return Boolean(getSupabaseAdmin());
}

/** Envia o arquivo ao bucket privado e devolve o caminho armazenado. */
export async function uploadExamFile(
  email: string,
  file: { name: string; type: string; buffer: Buffer }
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Armazenamento indisponível (Supabase não configurado).");
  await ensureExamBucket();
  const path = examObjectPath(email, file.name);
  const { error } = await supabase.storage.from(EXAMES_BUCKET).upload(path, file.buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** URL assinada para o celular/navegador enviar o PDF direto ao Storage (até 50 MB). */
export async function createSignedExamUpload(
  email: string,
  file: { name: string; mime: string }
): Promise<{ path: string; signedUrl: string; token: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Armazenamento indisponível (Supabase não configurado).");
  await ensureExamBucket();
  const path = examObjectPath(email, file.name);
  const { data, error } = await supabase.storage.from(EXAMES_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível preparar o envio.");
  }
  return { path: data.path || path, signedUrl: data.signedUrl, token: data.token };
}

export async function examObjectExists(filePath: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase.storage.from(EXAMES_BUCKET).createSignedUrl(filePath, 15);
  return !error;
}

export async function addUpload(
  input: Omit<PatientUpload, "id" | "createdAt" | "signedUrl">
): Promise<PatientUpload> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Armazenamento indisponível.");
  const row: PatientUpload = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  const { error } = await supabase.from("patient_uploads").insert({
    id: row.id,
    patient_email: row.patientEmail.toLowerCase().trim(),
    uploader: row.uploader,
    name: row.name,
    category: row.category ?? null,
    file_path: row.filePath,
    mime: row.mime ?? null,
    size_bytes: row.sizeBytes ?? null,
    exam_date: row.examDate ?? null,
    created_at: row.createdAt,
  });
  if (error) throw error;
  return row;
}

async function withSignedUrls(rows: PatientUpload[]): Promise<PatientUpload[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return rows;
  return Promise.all(
    rows.map(async (r) => {
      const { data } = await supabase.storage.from(EXAMES_BUCKET).createSignedUrl(r.filePath, 3600);
      return { ...r, signedUrl: data?.signedUrl ?? null };
    })
  );
}

export async function listUploads(email: string): Promise<PatientUpload[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("patient_uploads")
    .select("*")
    .eq("patient_email", email.toLowerCase().trim())
    .order("created_at", { ascending: false });
  if (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === "42P01" || /does not exist|schema cache/i.test(e.message || "")) return [];
    throw error;
  }
  return withSignedUrls((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
}
