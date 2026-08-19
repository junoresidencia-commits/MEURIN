import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type { TemplateType } from "./document-templates";

export interface CustomTemplate {
  id: string;
  doctorId: string;
  type: TemplateType;
  title: string;
  body: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "doctor-templates.json");
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
async function readFile(): Promise<CustomTemplate[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as CustomTemplate[];
  } catch {
    return [];
  }
}
async function writeFile(list: CustomTemplate[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
function mapRow(r: Record<string, unknown>): CustomTemplate {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    type: String(r.type) as TemplateType,
    title: String(r.title),
    body: String(r.body ?? ""),
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

/** Coluna ausente numa mensagem do PostgREST (migração incompleta). */
function missingColumn(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code !== "PGRST204" && error.code !== "42703" && !/column|schema cache/i.test(error.message || "")) return null;
  const msg = error.message || "";
  let m = msg.match(/find the '([^']+)' column/i); if (m) return m[1];
  m = msg.match(/column "?([a-z0-9_]+)"? .*does not exist/i); if (m) return m[1];
  return null;
}
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

export async function listTemplatesByDoctor(doctorId: string): Promise<CustomTemplate[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    // Sem filtro por "status" no servidor (a coluna pode não existir em bancos antigos).
    const { data, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? [])
        .filter((r) => String((r as Record<string, unknown>).status ?? "active") !== "archived")
        .map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list.filter((t) => t.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTemplate(input: Omit<CustomTemplate, "id" | "createdAt">): Promise<CustomTemplate> {
  const row: CustomTemplate = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    // Insert tolerante a colunas ausentes (scope/favorite/status/updated_at podem faltar).
    const full: Record<string, unknown> = {
      id: row.id, doctor_id: row.doctorId, scope: "personal", type: row.type,
      title: row.title, body: row.body, favorite: true, status: "active",
      created_at: row.createdAt, updated_at: row.createdAt,
    };
    let missingTable = false;
    let lastError: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await supabase.from("document_templates").insert(full);
      if (!error) return row;
      if (isMissingTable(error)) { missingTable = true; break; }
      const col = missingColumn(error);
      if (col && col in full) { delete full[col]; continue; }
      lastError = error; break;
    }
    if (!missingTable) {
      if (lastError) throw lastError;
    } else {
      tableMissing = true;
    }
  }
  const list = await readFile();
  list.push(row);
  await writeFile(list);
  return row;
}

export async function deleteTemplate(id: string, doctorId: string): Promise<boolean> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", id)
      .eq("doctor_id", doctorId);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return true;
    }
  }
  const list = await readFile();
  const next = list.filter((t) => !(t.id === id && t.doctorId === doctorId));
  await writeFile(next);
  return next.length !== list.length;
}
