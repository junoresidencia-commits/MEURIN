import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

// Comprovantes de PIX direto. Usa Supabase Storage (bucket privado "comprovantes")
// quando disponível; senão, cai para o disco local (apenas em desenvolvimento).
export const COMPROVANTES_BUCKET = "comprovantes";
const DATA_DIR = path.join(process.cwd(), "data", "comprovantes");

export interface SavedProof {
  proofPath: string; // "sb:<path>" (Storage) ou "local:<file>"
  mime: string;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "comprovante";
}

/** Salva o comprovante e devolve um caminho identificável (com prefixo de origem). */
export async function saveProof(
  bookingId: string,
  file: { name: string; type: string; buffer: Buffer }
): Promise<SavedProof> {
  const mime = file.type || "application/octet-stream";
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const key = `${bookingId}/${uuid()}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from(COMPROVANTES_BUCKET)
      .upload(key, file.buffer, { contentType: mime, upsert: false });
    if (error) throw error;
    return { proofPath: `sb:${key}`, mime };
  }
  // Fallback local (desenvolvimento).
  await fs.mkdir(DATA_DIR, { recursive: true });
  const fname = `${bookingId}-${uuid()}-${safeName(file.name)}`;
  await fs.writeFile(path.join(DATA_DIR, fname), file.buffer);
  return { proofPath: `local:${fname}`, mime };
}

/** Lê o comprovante para servir ao médico (autenticado). */
export async function readProof(proofPath: string): Promise<Buffer | null> {
  if (proofPath.startsWith("sb:")) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase.storage
      .from(COMPROVANTES_BUCKET)
      .download(proofPath.slice(3));
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (proofPath.startsWith("local:")) {
    try {
      return await fs.readFile(path.join(DATA_DIR, proofPath.slice(6)));
    } catch {
      return null;
    }
  }
  return null;
}
