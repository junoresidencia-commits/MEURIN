import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-admin";

export interface DocBox {
  field: string; // rótulo (ex.: "Nome do paciente")
  page: number;
  xFrac: number; // 0..1 da esquerda
  yFrac: number; // 0..1 do topo
  size?: number;
  text?: string; // valor padrão opcional (ex.: vazio p/ digitar)
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "ceaf-patterns.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return Boolean(e.message && /relation .* does not exist|could not find the table/i.test(e.message));
}
type Row = { doctorId: string; docKey: string; boxes: DocBox[] };
async function readLocal(): Promise<Row[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as Row[]; } catch { return []; }
}
async function writeLocal(rows: Row[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export async function getPattern(doctorId: string, docKey: string): Promise<DocBox[] | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("ceaf_doc_patterns").select("boxes").eq("doctor_id", doctorId).eq("doc_key", docKey).maybeSingle();
    if (!isMissing(error) && !error) return data ? (data.boxes as DocBox[]) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const rows = await readLocal();
  return rows.find((r) => r.doctorId === doctorId && r.docKey === docKey)?.boxes ?? null;
}

export async function savePattern(doctorId: string, docKey: string, boxes: DocBox[]): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("ceaf_doc_patterns").upsert(
      { doctor_id: doctorId, doc_key: docKey, boxes, updated_at: new Date().toISOString() },
      { onConflict: "doctor_id,doc_key" }
    );
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const rows = await readLocal();
  const idx = rows.findIndex((r) => r.doctorId === doctorId && r.docKey === docKey);
  if (idx >= 0) rows[idx].boxes = boxes; else rows.push({ doctorId, docKey, boxes });
  await writeLocal(rows);
}
