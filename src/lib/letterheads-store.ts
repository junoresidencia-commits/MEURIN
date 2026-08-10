import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type LetterheadMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/jpg"
  | "image/webp";

export type LetterheadPageMode = "all" | "first" | "simplified";

export type FieldPos = { x: number; y: number; w?: number };

export type LetterheadFields = {
  paciente?: FieldPos;
  cpf?: FieldPos;
  data?: FieldPos;
  idade?: FieldPos;
  conteudo?: FieldPos;
  assinatura?: FieldPos;
  qrcode?: FieldPos;
};

export interface Letterhead {
  id: string;
  doctorId: string;
  name: string;
  mime: LetterheadMime;
  fileData: string; // data URL
  fileName?: string | null;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fields: LetterheadFields;
  pageMode: LetterheadPageMode;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "letterheads.json");
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

async function readFile(): Promise<Letterhead[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Letterhead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFile(list: Letterhead[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): Letterhead {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    name: String(r.name),
    mime: String(r.mime) as LetterheadMime,
    fileData: String(r.file_data),
    fileName: (r.file_name as string | null) ?? null,
    marginTop: Number(r.margin_top ?? 22),
    marginBottom: Number(r.margin_bottom ?? 18),
    marginLeft: Number(r.margin_left ?? 10),
    marginRight: Number(r.margin_right ?? 10),
    fields: (r.fields as LetterheadFields) || {},
    pageMode: (String(r.page_mode || "all") as LetterheadPageMode),
    isDefault: Boolean(r.is_default),
    active: r.active !== false,
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at || r.created_at)).toISOString(),
  };
}

function toRow(l: Letterhead) {
  return {
    id: l.id,
    doctor_id: l.doctorId,
    name: l.name,
    mime: l.mime,
    file_data: l.fileData,
    file_name: l.fileName ?? null,
    margin_top: l.marginTop,
    margin_bottom: l.marginBottom,
    margin_left: l.marginLeft,
    margin_right: l.marginRight,
    fields: l.fields,
    page_mode: l.pageMode,
    is_default: l.isDefault,
    active: l.active,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}

export async function listLetterheads(doctorId: string): Promise<Letterhead[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("letterheads")
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
  return list.filter((l) => l.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLetterhead(id: string, doctorId?: string): Promise<Letterhead | null> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    let q = supabase.from("letterheads").select("*").eq("id", id);
    if (doctorId) q = q.eq("doctor_id", doctorId);
    const { data, error } = await q.maybeSingle();
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return data ? mapRow(data as Record<string, unknown>) : null;
    }
  }
  const list = await readFile();
  const found = list.find((l) => l.id === id) || null;
  if (!found) return null;
  if (doctorId && found.doctorId !== doctorId) return null;
  return found;
}

export async function createLetterhead(
  input: Omit<Letterhead, "id" | "createdAt" | "updatedAt" | "active" | "isDefault"> & {
    active?: boolean;
    isDefault?: boolean;
  }
): Promise<Letterhead> {
  const now = new Date().toISOString();
  const row: Letterhead = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    active: input.active !== false,
    isDefault: Boolean(input.isDefault),
    ...input,
  };

  if (row.isDefault) {
    await clearDefault(row.doctorId);
  }

  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("letterheads").insert(toRow(row));
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return row;
    }
  }

  const list = await readFile();
  if (row.isDefault) {
    for (const l of list) {
      if (l.doctorId === row.doctorId) l.isDefault = false;
    }
  }
  list.push(row);
  await writeFile(list);
  return row;
}

async function clearDefault(doctorId: string) {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    await supabase.from("letterheads").update({ is_default: false }).eq("doctor_id", doctorId);
    return;
  }
  const list = await readFile();
  await writeFile(list.map((l) => (l.doctorId === doctorId ? { ...l, isDefault: false } : l)));
}

export async function updateLetterhead(
  id: string,
  doctorId: string,
  patch: Partial<
    Pick<
      Letterhead,
      | "name"
      | "fileData"
      | "mime"
      | "fileName"
      | "marginTop"
      | "marginBottom"
      | "marginLeft"
      | "marginRight"
      | "fields"
      | "pageMode"
      | "isDefault"
      | "active"
    >
  >
): Promise<Letterhead | null> {
  const current = await getLetterhead(id, doctorId);
  if (!current) return null;
  if (patch.isDefault) await clearDefault(doctorId);
  const updated: Letterhead = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase
      .from("letterheads")
      .update({
        name: updated.name,
        file_data: updated.fileData,
        mime: updated.mime,
        file_name: updated.fileName ?? null,
        margin_top: updated.marginTop,
        margin_bottom: updated.marginBottom,
        margin_left: updated.marginLeft,
        margin_right: updated.marginRight,
        fields: updated.fields,
        page_mode: updated.pageMode,
        is_default: updated.isDefault,
        active: updated.active,
        updated_at: updated.updatedAt,
      })
      .eq("id", id)
      .eq("doctor_id", doctorId);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return updated;
    }
  }

  const list = await readFile();
  await writeFile(list.map((l) => (l.id === id && l.doctorId === doctorId ? updated : l)));
  return updated;
}

export async function deleteLetterhead(id: string, doctorId: string): Promise<boolean> {
  const current = await getLetterhead(id, doctorId);
  if (!current) return false;
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("letterheads").delete().eq("id", id).eq("doctor_id", doctorId);
    if (error) {
      if (isMissingTableError(error)) tableMissing = true;
      else throw error;
    } else {
      return true;
    }
  }
  const list = await readFile();
  await writeFile(list.filter((l) => !(l.id === id && l.doctorId === doctorId)));
  return true;
}

export async function duplicateLetterhead(id: string, doctorId: string): Promise<Letterhead | null> {
  const src = await getLetterhead(id, doctorId);
  if (!src) return null;
  return createLetterhead({
    doctorId,
    name: `${src.name} (cópia)`,
    mime: src.mime,
    fileData: src.fileData,
    fileName: src.fileName,
    marginTop: src.marginTop,
    marginBottom: src.marginBottom,
    marginLeft: src.marginLeft,
    marginRight: src.marginRight,
    fields: src.fields,
    pageMode: src.pageMode,
    isDefault: false,
    active: true,
  });
}

/** Público interno: sem fileData (para listas na UI). */
export function toPublicLetterhead(l: Letterhead) {
  return {
    id: l.id,
    name: l.name,
    mime: l.mime,
    fileName: l.fileName,
    marginTop: l.marginTop,
    marginBottom: l.marginBottom,
    marginLeft: l.marginLeft,
    marginRight: l.marginRight,
    fields: l.fields,
    pageMode: l.pageMode,
    isDefault: l.isDefault,
    active: l.active,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    hasFile: Boolean(l.fileData),
    previewData: l.mime.startsWith("image/") ? l.fileData : null,
  };
}
