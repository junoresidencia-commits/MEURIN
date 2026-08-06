import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export interface ProtocolMed {
  name: string;
  presentation?: string;
  monthlyQty?: string;
}
export interface CeafProtocol {
  id: string;
  name: string;
  cid10?: string | null;
  medications: ProtocolMed[];
  requiredExams: string[];
  requiredDocuments: string[];
  notes?: string | null;
  source?: string | null;
  active: boolean;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "protocols.json");
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
async function readFile(): Promise<CeafProtocol[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as CeafProtocol[];
  } catch {
    return [];
  }
}
async function writeFile(list: CeafProtocol[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
function mapRow(r: Record<string, unknown>): CeafProtocol {
  return {
    id: String(r.id),
    name: String(r.name),
    cid10: (r.cid10 as string | null) ?? null,
    medications: Array.isArray(r.medications) ? (r.medications as ProtocolMed[]) : [],
    requiredExams: Array.isArray(r.required_exams) ? (r.required_exams as string[]) : [],
    requiredDocuments: Array.isArray(r.required_documents) ? (r.required_documents as string[]) : [],
    notes: (r.notes as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    active: Boolean(r.active),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export async function listProtocols(onlyActive = false): Promise<CeafProtocol[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    let q = supabase.from("ceaf_protocols").select("*").order("name", { ascending: true });
    if (onlyActive) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return (onlyActive ? list.filter((p) => p.active) : list).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProtocol(
  input: Omit<CeafProtocol, "id" | "createdAt">
): Promise<CeafProtocol> {
  const row: CeafProtocol = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("ceaf_protocols").insert({
      id: row.id,
      name: row.name,
      cid10: row.cid10 ?? null,
      medications: row.medications,
      required_exams: row.requiredExams,
      required_documents: row.requiredDocuments,
      notes: row.notes ?? null,
      source: row.source ?? null,
      active: row.active,
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

export async function deleteProtocol(id: string): Promise<void> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("ceaf_protocols").delete().eq("id", id);
    if (error && !isMissing(error)) throw error;
    if (!error) return;
    tableMissing = true;
  }
  const list = await readFile();
  await writeFile(list.filter((p) => p.id !== id));
}
