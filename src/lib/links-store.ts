import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export interface DoctorLink {
  id: string;
  doctorId: string;
  title: string;
  url: string;
  category?: string | null;
  note?: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "doctor-links.json");
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
async function readFile(): Promise<DoctorLink[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as DoctorLink[];
  } catch {
    return [];
  }
}
async function writeFile(list: DoctorLink[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
function mapRow(r: Record<string, unknown>): DoctorLink {
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id),
    title: String(r.title),
    url: String(r.url),
    category: (r.category as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export async function listLinksByDoctor(doctorId: string): Promise<DoctorLink[]> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("doctor_links")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else throw error;
    } else {
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    }
  }
  const list = await readFile();
  return list
    .filter((l) => l.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createLink(
  input: Omit<DoctorLink, "id" | "createdAt">
): Promise<DoctorLink> {
  const row: DoctorLink = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("doctor_links").insert({
      id: row.id,
      doctor_id: row.doctorId,
      title: row.title,
      url: row.url,
      category: row.category ?? null,
      note: row.note ?? null,
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

/** Exclui um link. Só remove se pertencer ao próprio médico. */
export async function deleteLink(id: string, doctorId: string): Promise<boolean> {
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase
      .from("doctor_links")
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
  const next = list.filter((l) => !(l.id === id && l.doctorId === doctorId));
  await writeFile(next);
  return next.length !== list.length;
}
