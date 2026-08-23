import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";

export const DEFAULT_ATTENDANT_PASSWORD = "123456";

export interface AttendantPermissions {
  agenda: boolean;
  verHorarios: boolean;
  criarPaciente: boolean;
  editarCadastro: boolean;
  agendar: boolean;
  remarcar: boolean;
  cancelar: boolean;
  confirmar: boolean;
  ausencia: boolean;
  whatsapp: boolean;
}
export const DEFAULT_PERMISSIONS: AttendantPermissions = {
  agenda: true, verHorarios: true, criarPaciente: true, editarCadastro: true,
  agendar: true, remarcar: true, cancelar: true, confirmar: true, ausencia: true, whatsapp: true,
};

export interface Attendant {
  id: string;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  photoUrl?: string | null;
  passwordHash?: string | null;
  status: "active" | "inactive";
  createdAt: string;
  lastAccessAt?: string | null;
}
export interface AttendantLink {
  id: string;
  attendantId: string;
  doctorId: string;
  active: boolean;
  permissions: AttendantPermissions;
  createdAt: string;
  updatedAt: string;
}

export function normalizeCpf(cpf?: string | null): string {
  return String(cpf || "").replace(/\D/g, "");
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "attendants.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
type LocalDb = { attendants: Attendant[]; links: AttendantLink[]; audit: unknown[] };
async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; } catch { return { attendants: [], links: [], audit: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapAtt(r: Record<string, unknown>): Attendant {
  return {
    id: String(r.id), name: String(r.name),
    cpf: (r.cpf as string) ?? null, email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null, whatsapp: (r.whatsapp as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    passwordHash: (r.password_hash as string) ?? null,
    status: (r.status as "active" | "inactive") ?? "active",
    createdAt: String(r.created_at ?? new Date().toISOString()),
    lastAccessAt: (r.last_access_at as string) ?? null,
  };
}
function mapLink(r: Record<string, unknown>): AttendantLink {
  return {
    id: String(r.id), attendantId: String(r.attendant_id), doctorId: String(r.doctor_id),
    active: r.active !== false,
    permissions: { ...DEFAULT_PERMISSIONS, ...((r.permissions as object) ?? {}) } as AttendantPermissions,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

// ---------- Attendants ----------
export async function getAttendant(id: string): Promise<Attendant | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("attendants").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapAtt(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.attendants.find((a) => a.id === id) ?? null;
}

export async function findAttendantByCpfOrEmail(cpf?: string | null, email?: string | null): Promise<Attendant | null> {
  const norm = normalizeCpf(cpf);
  const mail = (email || "").toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    if (norm) {
      const { data } = await s.from("attendants").select("*").eq("cpf_normalized", norm).maybeSingle();
      if (data) return mapAtt(data);
    }
    if (mail) {
      const { data } = await s.from("attendants").select("*").ilike("email", mail).maybeSingle();
      if (data) return mapAtt(data);
    }
    return null;
  }
  const db = await readLocal();
  return db.attendants.find((a) => (norm && normalizeCpf(a.cpf) === norm) || (mail && (a.email || "").toLowerCase() === mail)) ?? null;
}

export async function createAttendant(input: { name: string; cpf?: string | null; email?: string | null; phone?: string | null; whatsapp?: string | null; password?: string }): Promise<Attendant> {
  const passwordHash = await bcrypt.hash(input.password || DEFAULT_ATTENDANT_PASSWORD, 10);
  const att: Attendant = {
    id: uuid(), name: input.name,
    cpf: input.cpf || null, email: input.email ? input.email.toLowerCase().trim() : null,
    phone: input.phone || null, whatsapp: input.whatsapp || null,
    passwordHash, status: "active", createdAt: new Date().toISOString(), lastAccessAt: null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendants").insert({
      id: att.id, name: att.name, cpf: att.cpf, cpf_normalized: normalizeCpf(att.cpf),
      email: att.email, phone: att.phone, whatsapp: att.whatsapp, password_hash: att.passwordHash,
      status: att.status, created_at: att.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return att; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.attendants.push(att);
  await writeLocal(db);
  return att;
}

export async function verifyAttendantPassword(att: Attendant, password: string): Promise<boolean> {
  if (!att.passwordHash) return false;
  return bcrypt.compare(password, att.passwordHash);
}

export async function touchAttendantAccess(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendants").update({ last_access_at: now }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const a = db.attendants.find((x) => x.id === id);
  if (a) { a.lastAccessAt = now; await writeLocal(db); }
}

export async function setAttendantPhoto(id: string, photoUrl: string | null): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendants").update({ photo_url: photoUrl }).eq("id", id);
    if (!error) return;
    if (isMissing(error)) {
      tableMissing = true;
    } else {
      const missingColumn = error.code === "PGRST204" || error.code === "42703" || /column|schema cache/i.test(error.message || "");
      // Coluna ainda não migrada (ex.: produção antes da migração): não persiste,
      // mas não quebra o upload nem tenta escrever no FS somente-leitura da Vercel.
      if (missingColumn) return;
      throw error;
    }
  }
  const db = await readLocal();
  const a = db.attendants.find((x) => x.id === id);
  if (a) { a.photoUrl = photoUrl; await writeLocal(db); }
}

// ---------- Links ----------
export async function getLink(attendantId: string, doctorId: string): Promise<AttendantLink | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("attendant_links").select("*").eq("attendant_id", attendantId).eq("doctor_id", doctorId).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapLink(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.find((l) => l.attendantId === attendantId && l.doctorId === doctorId) ?? null;
}

export async function upsertLink(attendantId: string, doctorId: string, permissions?: Partial<AttendantPermissions>): Promise<AttendantLink> {
  const existing = await getLink(attendantId, doctorId);
  const now = new Date().toISOString();
  const perms = { ...DEFAULT_PERMISSIONS, ...(existing?.permissions ?? {}), ...(permissions ?? {}) };
  const link: AttendantLink = existing
    ? { ...existing, permissions: perms, active: true, updatedAt: now }
    : { id: uuid(), attendantId, doctorId, active: true, permissions: perms, createdAt: now, updatedAt: now };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendant_links").upsert(
      { id: link.id, attendant_id: attendantId, doctor_id: doctorId, active: link.active, permissions: link.permissions, updated_at: now, created_at: link.createdAt },
      { onConflict: "attendant_id,doctor_id" }
    );
    if (!isMissing(error)) { if (error) throw error; return link; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.attendantId === attendantId && l.doctorId === doctorId);
  if (idx >= 0) db.links[idx] = link; else db.links.push(link);
  await writeLocal(db);
  return link;
}

export async function setLink(attendantId: string, doctorId: string, patch: { active?: boolean; permissions?: Partial<AttendantPermissions> }): Promise<AttendantLink | null> {
  const existing = await getLink(attendantId, doctorId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: AttendantLink = {
    ...existing,
    active: patch.active !== undefined ? patch.active : existing.active,
    permissions: patch.permissions ? { ...existing.permissions, ...patch.permissions } : existing.permissions,
    updatedAt: now,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendant_links").update({ active: updated.active, permissions: updated.permissions, updated_at: now }).eq("attendant_id", attendantId).eq("doctor_id", doctorId);
    if (!isMissing(error)) { if (error) throw error; return updated; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.attendantId === attendantId && l.doctorId === doctorId);
  if (idx < 0) return null;
  db.links[idx] = updated;
  await writeLocal(db);
  return updated;
}

export async function deleteLink(attendantId: string, doctorId: string): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendant_links").delete().eq("attendant_id", attendantId).eq("doctor_id", doctorId);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.links = db.links.filter((l) => !(l.attendantId === attendantId && l.doctorId === doctorId));
  await writeLocal(db);
}

export async function listLinksForDoctor(doctorId: string): Promise<(AttendantLink & { attendant: Attendant })[]> {
  let links: AttendantLink[] = [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("attendant_links").select("*").eq("doctor_id", doctorId);
    if (!isMissing(error) && !error) links = (data ?? []).map(mapLink);
    else if (isMissing(error)) tableMissing = true;
  }
  if (!active()) {
    const db = await readLocal();
    links = db.links.filter((l) => l.doctorId === doctorId);
  }
  const out: (AttendantLink & { attendant: Attendant })[] = [];
  for (const l of links) {
    const att = await getAttendant(l.attendantId);
    if (att) out.push({ ...l, attendant: att });
  }
  return out.sort((a, b) => a.attendant.name.localeCompare(b.attendant.name));
}

export async function listLinksForAttendant(attendantId: string): Promise<AttendantLink[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("attendant_links").select("*").eq("attendant_id", attendantId).eq("active", true);
    if (!isMissing(error) && !error) return (data ?? []).map(mapLink);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.filter((l) => l.attendantId === attendantId && l.active);
}

// ---------- Audit ----------
export async function logAttendantAudit(input: { attendantId: string; attendantName?: string; doctorId: string; action: string; patientKey?: string; bookingId?: string; detail?: string }): Promise<void> {
  const row = {
    id: uuid(), attendant_id: input.attendantId, attendant_name: input.attendantName ?? null,
    doctor_id: input.doctorId, action: input.action, patient_key: input.patientKey ?? null,
    booking_id: input.bookingId ?? null, detail: input.detail ?? null, created_at: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("attendant_audit").insert(row);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  db.audit.push(row);
  await writeLocal(db);
}
