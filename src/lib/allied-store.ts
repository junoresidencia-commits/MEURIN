import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  DEFAULT_ALLIED_PASSWORD,
  normalizeCpf,
  type AlliedLink,
  type AlliedNote,
  type AlliedNoteKind,
  type AlliedProfessional,
  type AlliedReferral,
  type AlliedRole,
  type AlliedStatus,
} from "./allied-types";

export * from "./allied-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "allied-team.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = {
  professionals: AlliedProfessional[];
  links: AlliedLink[];
  referrals: AlliedReferral[];
  notes: AlliedNote[];
};

async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; }
  catch { return { professionals: [], links: [], referrals: [], notes: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapPro(r: Record<string, unknown>): AlliedProfessional {
  return {
    id: String(r.id),
    role: (r.role as AlliedRole) || "psychology",
    name: String(r.name),
    cpf: (r.cpf as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    registry: (r.registry as string) ?? null,
    uf: (r.uf as string) ?? null,
    specialty: (r.specialty as string) ?? null,
    bio: (r.bio as string) ?? null,
    photoUrl: (r.photo_url as string) ?? (r.photoUrl as string) ?? null,
    passwordHash: (r.password_hash as string) ?? (r.passwordHash as string) ?? null,
    status: (r.status as AlliedStatus) ?? "active",
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    lastAccessAt: (r.last_access_at as string) ?? (r.lastAccessAt as string) ?? null,
  };
}
function mapLink(r: Record<string, unknown>): AlliedLink {
  return {
    id: String(r.id),
    professionalId: String(r.professional_id ?? r.professionalId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    active: r.active !== false,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}
function mapRef(r: Record<string, unknown>): AlliedReferral {
  return {
    id: String(r.id),
    role: (r.role as AlliedRole) || "psychology",
    doctorId: String(r.doctor_id ?? r.doctorId),
    doctorName: (r.doctor_name as string) ?? (r.doctorName as string) ?? null,
    professionalId: String(r.professional_id ?? r.professionalId),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    reason: (r.reason as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: (r.status as AlliedReferral["status"]) || "aberto",
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}
function mapNote(r: Record<string, unknown>): AlliedNote {
  return {
    id: String(r.id),
    role: (r.role as AlliedRole) || "psychology",
    kind: (r.kind as AlliedNoteKind) || "evolucao",
    professionalId: String(r.professional_id ?? r.professionalId),
    professionalName: String(r.professional_name ?? r.professionalName ?? ""),
    registry: (r.registry as string) ?? null,
    patientKey: String(r.patient_key ?? r.patientKey),
    title: (r.title as string) ?? null,
    body: String(r.body ?? ""),
    payload: (r.payload as Record<string, unknown>) ?? {},
    shareWithTeam: r.share_with_team !== false && r.shareWithTeam !== false,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    createdBy: String(r.created_by ?? r.createdBy ?? ""),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? new Date().toISOString()),
    updatedBy: (r.updated_by as string) ?? (r.updatedBy as string) ?? null,
  };
}

export async function getAlliedProfessional(id: string): Promise<AlliedProfessional | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_professionals").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapPro(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.professionals.find((p) => p.id === id) ?? null;
}

export async function findAlliedByCpfOrEmail(role: AlliedRole, cpf?: string | null, email?: string | null): Promise<AlliedProfessional | null> {
  const nrm = normalizeCpf(cpf);
  const mail = (email || "").toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    if (nrm) {
      const { data } = await s.from("allied_professionals").select("*").eq("role", role).eq("cpf_normalized", nrm).maybeSingle();
      if (data) return mapPro(data);
    }
    if (mail) {
      const { data } = await s.from("allied_professionals").select("*").eq("role", role).ilike("email", mail).maybeSingle();
      if (data) return mapPro(data);
    }
    return null;
  }
  const db = await readLocal();
  return db.professionals.find((p) => p.role === role && ((nrm && normalizeCpf(p.cpf) === nrm) || (mail && (p.email || "").toLowerCase() === mail))) ?? null;
}

export async function createAlliedProfessional(input: {
  role: AlliedRole; name: string; cpf?: string | null; email?: string | null; phone?: string | null;
  registry?: string | null; uf?: string | null; specialty?: string | null; bio?: string | null;
  password?: string; status?: AlliedStatus; photoUrl?: string | null;
}): Promise<AlliedProfessional> {
  const password = input.password || DEFAULT_ALLIED_PASSWORD;
  const row: AlliedProfessional = {
    id: uuid(), role: input.role, name: input.name.trim(),
    cpf: input.cpf || null, email: input.email || null, phone: input.phone || null,
    registry: input.registry || null, uf: input.uf || null, specialty: input.specialty || null,
    bio: input.bio || null, photoUrl: input.photoUrl || null,
    passwordHash: await bcrypt.hash(password, 10),
    status: input.status || "active",
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_professionals").insert({
      id: row.id, role: row.role, name: row.name, cpf: row.cpf, cpf_normalized: normalizeCpf(row.cpf) || null,
      email: row.email, phone: row.phone, registry: row.registry, uf: row.uf, specialty: row.specialty,
      bio: row.bio, photo_url: row.photoUrl, password_hash: row.passwordHash, status: row.status, created_at: row.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return row; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.professionals.push(row);
  await writeLocal(db);
  return row;
}

export async function listAlliedProfessionals(role?: AlliedRole): Promise<AlliedProfessional[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("allied_professionals").select("*").order("created_at", { ascending: false });
    if (role) q = q.eq("role", role);
    const { data, error } = await q;
    if (!isMissing(error) && !error) return (data ?? []).map(mapPro);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.professionals.filter((p) => !role || p.role === role).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setAlliedStatus(id: string, status: AlliedStatus): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_professionals").update({ status }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const p = db.professionals.find((x) => x.id === id);
  if (p) { p.status = status; await writeLocal(db); }
}

export async function verifyAlliedPassword(pro: AlliedProfessional, password: string): Promise<boolean> {
  if (!pro.passwordHash) return false;
  return bcrypt.compare(password, pro.passwordHash);
}

export async function touchAlliedAccess(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_professionals").update({ last_access_at: now }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const p = db.professionals.find((x) => x.id === id);
  if (p) { p.lastAccessAt = now; await writeLocal(db); }
}

export async function getAlliedLink(professionalId: string, doctorId: string): Promise<AlliedLink | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_links").select("*").eq("professional_id", professionalId).eq("doctor_id", doctorId).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapLink(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.find((l) => l.professionalId === professionalId && l.doctorId === doctorId) ?? null;
}

export async function upsertAlliedLink(professionalId: string, doctorId: string): Promise<AlliedLink> {
  const existing = await getAlliedLink(professionalId, doctorId);
  const now = new Date().toISOString();
  const link: AlliedLink = existing
    ? { ...existing, active: true, updatedAt: now }
    : { id: uuid(), professionalId, doctorId, active: true, createdAt: now, updatedAt: now };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_links").upsert({
      id: link.id, professional_id: professionalId, doctor_id: doctorId, active: true, created_at: link.createdAt, updated_at: now,
    }, { onConflict: "professional_id,doctor_id" });
    if (!isMissing(error)) { if (error) throw error; return link; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.professionalId === professionalId && l.doctorId === doctorId);
  if (idx >= 0) db.links[idx] = link; else db.links.push(link);
  await writeLocal(db);
  return link;
}

export async function setAlliedLinkActive(professionalId: string, doctorId: string, activeFlag: boolean): Promise<AlliedLink | null> {
  const existing = await getAlliedLink(professionalId, doctorId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated = { ...existing, active: activeFlag, updatedAt: now };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_links").update({ active: activeFlag, updated_at: now }).eq("professional_id", professionalId).eq("doctor_id", doctorId);
    if (!isMissing(error)) return updated;
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.professionalId === professionalId && l.doctorId === doctorId);
  if (idx >= 0) db.links[idx] = updated;
  await writeLocal(db);
  return updated;
}

export async function deleteAlliedLink(professionalId: string, doctorId: string): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_links").delete().eq("professional_id", professionalId).eq("doctor_id", doctorId);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  db.links = db.links.filter((l) => !(l.professionalId === professionalId && l.doctorId === doctorId));
  await writeLocal(db);
}

export async function listAlliedLinksForDoctor(doctorId: string): Promise<(AlliedLink & { professional: AlliedProfessional })[]> {
  const links: AlliedLink[] = [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_links").select("*").eq("doctor_id", doctorId);
    if (!isMissing(error) && !error) links.push(...(data ?? []).map(mapLink));
    else if (isMissing(error)) tableMissing = true;
  }
  if (!active() || links.length === 0) {
    const db = await readLocal();
    links.push(...db.links.filter((l) => l.doctorId === doctorId));
  }
  const out: (AlliedLink & { professional: AlliedProfessional })[] = [];
  for (const l of links) {
    const p = await getAlliedProfessional(l.professionalId);
    if (p) out.push({ ...l, professional: p });
  }
  return out;
}

export async function listActiveDoctorIdsForProfessional(professionalId: string): Promise<string[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_links").select("doctor_id").eq("professional_id", professionalId).eq("active", true);
    if (!isMissing(error) && !error) return (data ?? []).map((r) => String(r.doctor_id));
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.filter((l) => l.professionalId === professionalId && l.active).map((l) => l.doctorId);
}

export async function addAlliedReferral(input: Omit<AlliedReferral, "id" | "createdAt" | "status"> & { status?: AlliedReferral["status"] }): Promise<AlliedReferral> {
  const ref: AlliedReferral = {
    id: uuid(), createdAt: new Date().toISOString(), status: input.status ?? "aberto",
    role: input.role, doctorId: input.doctorId, doctorName: input.doctorName ?? null,
    professionalId: input.professionalId, patientKey: input.patientKey, patientName: input.patientName ?? null,
    reason: input.reason ?? null, notes: input.notes ?? null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_referrals").insert({
      id: ref.id, role: ref.role, doctor_id: ref.doctorId, doctor_name: ref.doctorName,
      professional_id: ref.professionalId, patient_key: ref.patientKey, patient_name: ref.patientName,
      reason: ref.reason, notes: ref.notes, status: ref.status, created_at: ref.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return ref; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.referrals.push(ref);
  await writeLocal(db);
  return ref;
}

export async function listReferralsForProfessional(professionalId: string): Promise<AlliedReferral[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_referrals").select("*").eq("professional_id", professionalId).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapRef);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.filter((r) => r.professionalId === professionalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAlliedReferralsForPatient(patientKey: string): Promise<AlliedReferral[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("allied_referrals").select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapRef);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.filter((r) => r.patientKey === patientKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setAlliedReferralStatus(id: string, status: AlliedReferral["status"]): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_referrals").update({ status }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const r = db.referrals.find((x) => x.id === id);
  if (r) { r.status = status; await writeLocal(db); }
}

export async function addAlliedNote(input: Omit<AlliedNote, "id" | "createdAt" | "updatedAt">): Promise<AlliedNote> {
  const now = new Date().toISOString();
  const note: AlliedNote = { ...input, id: uuid(), createdAt: now, updatedAt: now };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("allied_notes").insert({
      id: note.id, role: note.role, kind: note.kind, professional_id: note.professionalId,
      professional_name: note.professionalName, registry: note.registry, patient_key: note.patientKey,
      title: note.title, body: note.body, payload: note.payload, share_with_team: note.shareWithTeam,
      created_at: note.createdAt, created_by: note.createdBy, updated_at: note.updatedAt, updated_by: note.updatedBy,
    });
    if (!isMissing(error)) { if (error) throw error; return note; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.notes.push(note);
  await writeLocal(db);
  return note;
}

export async function updateAlliedNote(id: string, patch: { body?: string; payload?: Record<string, unknown>; shareWithTeam?: boolean; title?: string | null }, by: string): Promise<AlliedNote | null> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data: cur } = await s.from("allied_notes").select("*").eq("id", id).maybeSingle();
    if (!cur) return null;
    const next = {
      body: patch.body ?? cur.body,
      payload: patch.payload ?? cur.payload,
      share_with_team: patch.shareWithTeam ?? cur.share_with_team,
      title: patch.title !== undefined ? patch.title : cur.title,
      updated_at: now,
      updated_by: by,
    };
    const { error } = await s.from("allied_notes").update(next).eq("id", id);
    if (!isMissing(error) && !error) return mapNote({ ...cur, ...next });
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  const n = db.notes.find((x) => x.id === id);
  if (!n) return null;
  if (patch.body !== undefined) n.body = patch.body;
  if (patch.payload) n.payload = patch.payload;
  if (patch.shareWithTeam !== undefined) n.shareWithTeam = patch.shareWithTeam;
  if (patch.title !== undefined) n.title = patch.title;
  n.updatedAt = now;
  n.updatedBy = by;
  await writeLocal(db);
  return n;
}

export async function listNotesForPatient(patientKey: string, role?: AlliedRole): Promise<AlliedNote[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("allied_notes").select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (role) q = q.eq("role", role);
    const { data, error } = await q;
    if (!isMissing(error) && !error) return (data ?? []).map(mapNote);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.notes
    .filter((n) => n.patientKey === patientKey && (!role || n.role === role))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listNotesForProfessional(professionalId: string, patientKey?: string): Promise<AlliedNote[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("allied_notes").select("*").eq("professional_id", professionalId).order("created_at", { ascending: false });
    if (patientKey) q = q.eq("patient_key", patientKey);
    const { data, error } = await q;
    if (!isMissing(error) && !error) return (data ?? []).map(mapNote);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.notes
    .filter((n) => n.professionalId === professionalId && (!patientKey || n.patientKey === patientKey))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Profissional atribuído atual por especialidade (último encaminhamento aberto/atendido). */
export function currentAssignment(referrals: AlliedReferral[], role: AlliedRole): AlliedReferral | null {
  return referrals.find((r) => r.role === role && r.status !== "encerrado") || null;
}
