import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

/* Armazenamento de arquivos (papéis timbrados e PDFs gerados).
   Usa Supabase Storage (bucket privado) quando configurado; senão, salva em data/
   para funcionar em desenvolvimento. `storage` guarda qual backend foi usado. */

export type StorageKind = "supabase" | "local";
const LOCAL_ROOT = path.join(process.cwd(), "data", "storage");

const ensuredBuckets = new Set<string>();
async function ensureBucket(bucket: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || ensuredBuckets.has(bucket)) return;
  try {
    // Cria o bucket privado se não existir (idempotente/best-effort).
    const { data } = await supabase.storage.getBucket(bucket);
    if (!data) await supabase.storage.createBucket(bucket, { public: false });
  } catch {
    try { await supabase.storage.createBucket(bucket, { public: false }); } catch { /* já existe */ }
  }
  ensuredBuckets.add(bucket);
}

function sanitize(name: string): string {
  return (name || "arquivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "arquivo";
}

async function writeLocal(bucket: string, relPath: string, buffer: Buffer): Promise<{ path: string; storage: StorageKind }> {
  const roots = [LOCAL_ROOT, path.join("/tmp", "meurim-storage")];
  let lastErr: unknown;
  for (const root of roots) {
    try {
      const full = path.join(root, bucket, relPath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer);
      return { path: relPath, storage: "local" };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha ao gravar arquivo local.");
}

export async function saveFile(
  bucket: string,
  keyPrefix: string,
  file: { name: string; type?: string; buffer: Buffer }
): Promise<{ path: string; storage: StorageKind }> {
  const relPath = `${keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, "_")}/${uuid()}-${sanitize(file.name)}`;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await ensureBucket(bucket);
      const { error } = await supabase.storage.from(bucket).upload(relPath, file.buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (!error) return { path: relPath, storage: "supabase" };
      console.error("storage upload", bucket, error.message || error);
    } catch (err) {
      console.error("storage upload", bucket, err);
    }
  }
  return writeLocal(bucket, relPath, file.buffer);
}

export async function readFile(
  bucket: string,
  storage: StorageKind,
  filePath: string
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (storage === "supabase") {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return { buffer: buf, mime: data.type || "application/octet-stream" };
  }
  for (const root of [LOCAL_ROOT, path.join("/tmp", "meurim-storage")]) {
    try {
      const buffer = await fs.readFile(path.join(root, bucket, filePath));
      return { buffer, mime: guessMime(filePath) };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

export async function deleteFile(bucket: string, storage: StorageKind, filePath: string): Promise<void> {
  if (storage === "supabase") {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    await supabase.storage.from(bucket).remove([filePath]).catch(() => {});
    return;
  }
  try { await fs.unlink(path.join(LOCAL_ROOT, bucket, filePath)); } catch { /* ok */ }
}

function guessMime(p: string): string {
  const ext = p.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export const LETTERHEADS_BUCKET = "letterheads";
export const DOCPDF_BUCKET = "documents";
