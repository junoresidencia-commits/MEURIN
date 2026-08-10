import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { LETTERHEADS_BUCKET, deleteFile, saveFile, type StorageKind } from "./doc-storage";

export interface LetterheadArea {
  marginTop: number; // frações 0..1 da altura A4
  marginBottom: number;
  marginLeft: number; // frações 0..1 da largura A4
  marginRight: number;
  repeat: "all" | "first" | "simplified";
  showPatientHeader: boolean;
  showSignature: boolean;
}

export interface Letterhead {
  id: string;
  doctorId: string;
  name: string;
  kind: "pdf" | "image";
  mime?: string | null;
  storage: StorageKind;
  filePath: string;
  isDefault: boolean;
  active: boolean;
  area: LetterheadArea;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_AREA: LetterheadArea = {
  marginTop: 0.22,
  marginBottom: 0.14,
  marginLeft: 0.1,
  marginRight: 0.1,
  repeat: "all",
  showPatientHeader: true,
  showSignature: true,
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "letterheads.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
async function readLocal(): Promise<Letterhead[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as Letterhead[]; } catch { return []; }
}
async function writeLocal(list: Letterhead[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): Letterhead {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    name: String(r.name),
    kind: (r.kind as "pdf" | "image") ?? "image",
    mime: (r.mime as string) ?? null,
    storage: (r.storage as StorageKind) ?? "supabase",
    filePath: String(r.file_path),
    isDefault: Boolean(r.is_default),
    active: r.active !== false,
    area: { ...DEFAULT_AREA, ...((r.area as object) ?? {}) } as LetterheadArea,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}
function toRow(l: Letterhead) {
  return {
    id: l.id,
    doctor_id: l.doctorId,
    name: l.name,
    kind: l.kind,
    mime: l.mime ?? null,
    storage: l.storage,
    file_path: l.filePath,
    is_default: l.isDefault,
    active: l.active,
    area: l.area,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}

export async function listLetterheads(doctorId: string): Promise<Letterhead[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("letterheads").select("*").eq("doctor_id", doctorId).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapRow);
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.filter((l) => l.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLetterhead(id: string): Promise<Letterhead | null> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase.from("letterheads").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapRow(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.find((l) => l.id === id) ?? null;
}

/** Cria um papel timbrado (arquivo já salvo no storage). Se for o 1º do médico, vira padrão. */
export async function createLetterhead(input: {
  doctorId: string;
  name: string;
  kind: "pdf" | "image";
  mime?: string;
  storage: StorageKind;
  filePath: string;
}): Promise<Letterhead> {
  const existing = await listLetterheads(input.doctorId);
  const now = new Date().toISOString();
  const lh: Letterhead = {
    id: uuid(),
    doctorId: input.doctorId,
    name: input.name,
    kind: input.kind,
    mime: input.mime ?? null,
    storage: input.storage,
    filePath: input.filePath,
    isDefault: existing.length === 0,
    active: true,
    area: DEFAULT_AREA,
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("letterheads").insert(toRow(lh));
    if (!isMissing(error)) { if (error) throw error; return lh; }
    tableMissing = true;
  }
  const list = await readLocal();
  list.push(lh);
  await writeLocal(list);
  return lh;
}

export async function updateLetterhead(id: string, doctorId: string, patch: Partial<Pick<Letterhead, "name" | "active" | "area">>): Promise<Letterhead | null> {
  const now = new Date().toISOString();
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const upd: Record<string, unknown> = { updated_at: now };
    if (patch.name !== undefined) upd.name = patch.name;
    if (patch.active !== undefined) upd.active = patch.active;
    if (patch.area !== undefined) upd.area = patch.area;
    const { data, error } = await supabase.from("letterheads").update(upd).eq("id", id).eq("doctor_id", doctorId).select().maybeSingle();
    if (!isMissing(error)) { if (error) throw error; return data ? mapRow(data) : null; }
    tableMissing = true;
  }
  const list = await readLocal();
  const idx = list.findIndex((l) => l.id === id && l.doctorId === doctorId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch, area: patch.area ? { ...DEFAULT_AREA, ...patch.area } : list[idx].area, updatedAt: now };
  await writeLocal(list);
  return list[idx];
}

export async function setDefaultLetterhead(id: string, doctorId: string): Promise<void> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    await supabase.from("letterheads").update({ is_default: false }).eq("doctor_id", doctorId);
    await supabase.from("letterheads").update({ is_default: true }).eq("id", id).eq("doctor_id", doctorId);
    return;
  }
  const list = await readLocal();
  for (const l of list) if (l.doctorId === doctorId) l.isDefault = l.id === id;
  await writeLocal(list);
}

export async function deleteLetterhead(id: string, doctorId: string): Promise<void> {
  const lh = await getLetterhead(id);
  if (lh && lh.doctorId === doctorId) {
    await deleteFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath).catch(() => {});
  }
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("letterheads").delete().eq("id", id).eq("doctor_id", doctorId);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const list = await readLocal();
  await writeLocal(list.filter((l) => !(l.id === id && l.doctorId === doctorId)));
}

export async function getDefaultLetterhead(doctorId: string): Promise<Letterhead | null> {
  const list = await listLetterheads(doctorId);
  return list.find((l) => l.isDefault && l.active) ?? list.find((l) => l.active) ?? null;
}

/** Helper para as rotas: salva o arquivo e cria o registro. */
export async function saveLetterheadUpload(doctorId: string, name: string, file: { name: string; type: string; buffer: Buffer }): Promise<Letterhead> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const kind: "pdf" | "image" = isPdf ? "pdf" : "image";
  const { path: filePath, storage } = await saveFile(LETTERHEADS_BUCKET, doctorId, file);
  return createLetterhead({ doctorId, name, kind, mime: file.type, storage, filePath });
}
