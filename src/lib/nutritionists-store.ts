import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase-admin";
import type { PixProfile } from "./types";

export const DEFAULT_NUTRITIONIST_PASSWORD = "123456";

export type NutritionistStatus = "pending" | "active" | "inactive" | "rejected" | "suspended";

export interface NutritionistDocument { name: string; url: string }

export interface Nutritionist {
  id: string;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  crn?: string | null;
  uf?: string | null;
  specialty?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  documents?: NutritionistDocument[];
  passwordHash?: string | null;
  signatureUrl?: string | null;
  status: NutritionistStatus;
  // Financeiro / agenda próprios
  consultationPriceCents?: number | null;
  returnPriceCents?: number | null;
  pixProfile?: PixProfile | null;
  commissionPercent?: number | null; // % da plataforma (admin)
  payoutStatus?: "active" | "pending" | "blocked";
  createdAt: string;
  lastAccessAt?: string | null;
}

export interface NutritionPermissions {
  verExames: boolean;
  verDiario: boolean;
  criarPlano: boolean;
  comentarDiario: boolean;
}
export const DEFAULT_NUTRITION_PERMISSIONS: NutritionPermissions = {
  verExames: true, verDiario: true, criarPlano: true, comentarDiario: true,
};

export interface NutritionistLink {
  id: string;
  nutritionistId: string;
  doctorId: string;
  active: boolean;
  permissions: NutritionPermissions;
  createdAt: string;
  updatedAt: string;
}
export interface NutritionReferral {
  id: string;
  doctorId: string;
  doctorName?: string | null;
  nutritionistId?: string | null;
  patientKey: string;
  patientName?: string | null;
  reason?: string | null;
  objective?: string | null;
  restrictions?: string | null;
  priority: "normal" | "alta";
  notes?: string | null;
  status: "aberto" | "atendido";
  createdAt: string;
}
export interface NutritionConsultation {
  id: string;
  nutritionistId: string;
  nutritionistName?: string | null;
  doctorId?: string | null;
  patientKey: string;
  patientName?: string | null;
  assessment: Record<string, unknown>;
  plan: Record<string, unknown>;
  sharedWithPatient: boolean;
  documentId?: string | null;
  createdAt: string;
}

export function normalizeCpf(cpf?: string | null): string {
  return String(cpf || "").replace(/\D/g, "");
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "nutritionists.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}
type LocalDb = {
  nutritionists: Nutritionist[];
  links: NutritionistLink[];
  referrals: NutritionReferral[];
  consultations: NutritionConsultation[];
};
async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; }
  catch { return { nutritionists: [], links: [], referrals: [], consultations: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapNut(r: Record<string, unknown>): Nutritionist {
  return {
    id: String(r.id), name: String(r.name),
    cpf: (r.cpf as string) ?? null, email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null, crn: (r.crn as string) ?? null, uf: (r.uf as string) ?? null,
    specialty: (r.specialty as string) ?? null, bio: (r.bio as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    documents: Array.isArray(r.documents) ? (r.documents as NutritionistDocument[]) : [],
    passwordHash: (r.password_hash as string) ?? null, signatureUrl: (r.signature_url as string) ?? null,
    status: (r.status as NutritionistStatus) ?? "active",
    consultationPriceCents: r.consultation_price_cents != null ? Number(r.consultation_price_cents) : null,
    returnPriceCents: r.return_price_cents != null ? Number(r.return_price_cents) : null,
    pixProfile: (r.pix_profile as PixProfile) ?? null,
    commissionPercent: r.commission_percent != null ? Number(r.commission_percent) : null,
    payoutStatus: (r.payout_status as "active" | "pending" | "blocked") ?? "active",
    createdAt: String(r.created_at ?? new Date().toISOString()),
    lastAccessAt: (r.last_access_at as string) ?? null,
  };
}
function mapLink(r: Record<string, unknown>): NutritionistLink {
  return {
    id: String(r.id), nutritionistId: String(r.nutritionist_id), doctorId: String(r.doctor_id),
    active: r.active !== false,
    permissions: { ...DEFAULT_NUTRITION_PERMISSIONS, ...((r.permissions as object) ?? {}) } as NutritionPermissions,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}
function mapReferral(r: Record<string, unknown>): NutritionReferral {
  return {
    id: String(r.id), doctorId: String(r.doctor_id), doctorName: (r.doctor_name as string) ?? null,
    nutritionistId: (r.nutritionist_id as string) ?? null,
    patientKey: String(r.patient_key), patientName: (r.patient_name as string) ?? null,
    reason: (r.reason as string) ?? null, objective: (r.objective as string) ?? null,
    restrictions: (r.restrictions as string) ?? null,
    priority: (r.priority as "normal" | "alta") ?? "normal",
    notes: (r.notes as string) ?? null, status: (r.status as "aberto" | "atendido") ?? "aberto",
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}
function mapConsult(r: Record<string, unknown>): NutritionConsultation {
  return {
    id: String(r.id), nutritionistId: String(r.nutritionist_id), nutritionistName: (r.nutritionist_name as string) ?? null,
    doctorId: (r.doctor_id as string) ?? null, patientKey: String(r.patient_key), patientName: (r.patient_name as string) ?? null,
    assessment: (r.assessment as Record<string, unknown>) ?? {},
    plan: (r.plan as Record<string, unknown>) ?? {},
    sharedWithPatient: r.shared_with_patient === true,
    documentId: (r.document_id as string) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

// ---------- Nutritionists ----------
export async function getNutritionist(id: string): Promise<Nutritionist | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutritionists").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapNut(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.nutritionists.find((a) => a.id === id) ?? null;
}

export async function findNutritionistByCpfOrEmail(cpf?: string | null, email?: string | null): Promise<Nutritionist | null> {
  const nrm = normalizeCpf(cpf);
  const mail = (email || "").toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    if (nrm) {
      const { data } = await s.from("nutritionists").select("*").eq("cpf_normalized", nrm).maybeSingle();
      if (data) return mapNut(data);
    }
    if (mail) {
      const { data } = await s.from("nutritionists").select("*").ilike("email", mail).maybeSingle();
      if (data) return mapNut(data);
    }
    return null;
  }
  const db = await readLocal();
  return db.nutritionists.find((a) => (nrm && normalizeCpf(a.cpf) === nrm) || (mail && (a.email || "").toLowerCase() === mail)) ?? null;
}

export async function createNutritionist(input: { name: string; cpf?: string | null; email?: string | null; phone?: string | null; crn?: string | null; uf?: string | null; specialty?: string | null; bio?: string | null; password?: string; status?: NutritionistStatus; photoUrl?: string | null; documents?: NutritionistDocument[] }): Promise<Nutritionist> {
  const passwordHash = await bcrypt.hash(input.password || DEFAULT_NUTRITIONIST_PASSWORD, 10);
  const nut: Nutritionist = {
    id: uuid(), name: input.name,
    cpf: input.cpf || null, email: input.email ? input.email.toLowerCase().trim() : null,
    phone: input.phone || null, crn: input.crn || null, uf: input.uf || null,
    specialty: input.specialty || "Nutrição", bio: input.bio || null,
    photoUrl: input.photoUrl || null, documents: input.documents || [],
    passwordHash, signatureUrl: null, status: input.status || "active", createdAt: new Date().toISOString(), lastAccessAt: null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionists").insert({
      id: nut.id, name: nut.name, cpf: nut.cpf, cpf_normalized: normalizeCpf(nut.cpf),
      email: nut.email, phone: nut.phone, crn: nut.crn, uf: nut.uf, specialty: nut.specialty, bio: nut.bio,
      photo_url: nut.photoUrl, documents: nut.documents,
      password_hash: nut.passwordHash, status: nut.status, created_at: nut.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return nut; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.nutritionists.push(nut);
  await writeLocal(db);
  return nut;
}

export async function updateNutritionistStatus(id: string, status: NutritionistStatus): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionists").update({ status }).eq("id", id);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  const n = db.nutritionists.find((x) => x.id === id);
  if (n) { n.status = status; await writeLocal(db); }
}

function missingCol(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code !== "PGRST204" && error.code !== "42703" && !/column|schema cache/i.test(error.message || "")) return null;
  const msg = error.message || "";
  let m = msg.match(/find the '([^']+)' column/i); if (m) return m[1];
  m = msg.match(/column "?([a-z0-9_]+)"? .*does not exist/i); if (m) return m[1];
  return null;
}

/** Update resiliente a coluna ausente (migração pendente). */
async function updateNutritionistRow(id: string, patch: Record<string, unknown>): Promise<boolean> {
  if (!active()) return false;
  const s = getSupabaseAdmin()!;
  const current = { ...patch };
  for (let i = 0; i < 8; i++) {
    const { error } = await s.from("nutritionists").update(current).eq("id", id);
    if (!error) return true;
    if (isMissing(error)) { tableMissing = true; return false; }
    const col = missingCol(error);
    if (!col || !(col in current)) throw error;
    delete current[col];
    if (Object.keys(current).length === 0) return true;
  }
  return true;
}

export async function updateNutritionistSettings(id: string, patch: { consultationPriceCents?: number | null; returnPriceCents?: number | null; pixProfile?: PixProfile | null; signatureUrl?: string | null; photoUrl?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.consultationPriceCents !== undefined) row.consultation_price_cents = patch.consultationPriceCents;
  if (patch.returnPriceCents !== undefined) row.return_price_cents = patch.returnPriceCents;
  if (patch.pixProfile !== undefined) row.pix_profile = patch.pixProfile;
  if (patch.signatureUrl !== undefined) row.signature_url = patch.signatureUrl;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (Object.keys(row).length === 0) return;
  const done = await updateNutritionistRow(id, row);
  if (done) return;
  const db = await readLocal();
  const n = db.nutritionists.find((x) => x.id === id);
  if (n) {
    if (patch.consultationPriceCents !== undefined) n.consultationPriceCents = patch.consultationPriceCents;
    if (patch.returnPriceCents !== undefined) n.returnPriceCents = patch.returnPriceCents;
    if (patch.pixProfile !== undefined) n.pixProfile = patch.pixProfile;
    if (patch.signatureUrl !== undefined) n.signatureUrl = patch.signatureUrl;
    if (patch.photoUrl !== undefined) n.photoUrl = patch.photoUrl;
    await writeLocal(db);
  }
}

export async function updateNutritionistFinance(id: string, patch: { commissionPercent?: number | null; payoutStatus?: "active" | "pending" | "blocked" }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.commissionPercent !== undefined) row.commission_percent = patch.commissionPercent;
  if (patch.payoutStatus !== undefined) row.payout_status = patch.payoutStatus;
  if (Object.keys(row).length === 0) return;
  const done = await updateNutritionistRow(id, row);
  if (done) return;
  const db = await readLocal();
  const n = db.nutritionists.find((x) => x.id === id);
  if (n) {
    if (patch.commissionPercent !== undefined) n.commissionPercent = patch.commissionPercent;
    if (patch.payoutStatus !== undefined) n.payoutStatus = patch.payoutStatus;
    await writeLocal(db);
  }
}

export async function listAllNutritionists(): Promise<Nutritionist[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutritionists").select("*").order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapNut);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return [...db.nutritionists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function verifyNutritionistPassword(nut: Nutritionist, password: string): Promise<boolean> {
  if (!nut.passwordHash) return false;
  return bcrypt.compare(password, nut.passwordHash);
}

export async function touchNutritionistAccess(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionists").update({ last_access_at: now }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const a = db.nutritionists.find((x) => x.id === id);
  if (a) { a.lastAccessAt = now; await writeLocal(db); }
}

// ---------- Links ----------
export async function getNutritionLink(nutritionistId: string, doctorId: string): Promise<NutritionistLink | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutritionist_links").select("*").eq("nutritionist_id", nutritionistId).eq("doctor_id", doctorId).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapLink(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.find((l) => l.nutritionistId === nutritionistId && l.doctorId === doctorId) ?? null;
}

export async function upsertNutritionLink(nutritionistId: string, doctorId: string, permissions?: Partial<NutritionPermissions>): Promise<NutritionistLink> {
  const existing = await getNutritionLink(nutritionistId, doctorId);
  const now = new Date().toISOString();
  const perms = { ...DEFAULT_NUTRITION_PERMISSIONS, ...(existing?.permissions ?? {}), ...(permissions ?? {}) };
  const link: NutritionistLink = existing
    ? { ...existing, active: true, permissions: perms, updatedAt: now }
    : { id: uuid(), nutritionistId, doctorId, active: true, permissions: perms, createdAt: now, updatedAt: now };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionist_links").upsert(
      { id: link.id, nutritionist_id: nutritionistId, doctor_id: doctorId, active: link.active, permissions: link.permissions, updated_at: now, created_at: link.createdAt },
      { onConflict: "nutritionist_id,doctor_id" }
    );
    if (!isMissing(error)) { if (error) throw error; return link; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.nutritionistId === nutritionistId && l.doctorId === doctorId);
  if (idx >= 0) db.links[idx] = link; else db.links.push(link);
  await writeLocal(db);
  return link;
}

export async function setNutritionLink(nutritionistId: string, doctorId: string, patch: { active?: boolean; permissions?: Partial<NutritionPermissions> }): Promise<NutritionistLink | null> {
  const existing = await getNutritionLink(nutritionistId, doctorId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: NutritionistLink = {
    ...existing,
    active: patch.active !== undefined ? patch.active : existing.active,
    permissions: patch.permissions ? { ...existing.permissions, ...patch.permissions } : existing.permissions,
    updatedAt: now,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionist_links").update({ active: updated.active, permissions: updated.permissions, updated_at: now }).eq("nutritionist_id", nutritionistId).eq("doctor_id", doctorId);
    if (!isMissing(error)) { if (error) throw error; return updated; }
    tableMissing = true;
  }
  const db = await readLocal();
  const idx = db.links.findIndex((l) => l.nutritionistId === nutritionistId && l.doctorId === doctorId);
  if (idx < 0) return null;
  db.links[idx] = updated;
  await writeLocal(db);
  return updated;
}

export async function deleteNutritionLink(nutritionistId: string, doctorId: string): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutritionist_links").delete().eq("nutritionist_id", nutritionistId).eq("doctor_id", doctorId);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.links = db.links.filter((l) => !(l.nutritionistId === nutritionistId && l.doctorId === doctorId));
  await writeLocal(db);
}

export async function listNutritionLinksForDoctor(doctorId: string): Promise<(NutritionistLink & { nutritionist: Nutritionist })[]> {
  let links: NutritionistLink[] = [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutritionist_links").select("*").eq("doctor_id", doctorId);
    if (!isMissing(error) && !error) links = (data ?? []).map(mapLink);
    else if (isMissing(error)) tableMissing = true;
  }
  if (!active()) {
    const db = await readLocal();
    links = db.links.filter((l) => l.doctorId === doctorId);
  }
  const out: (NutritionistLink & { nutritionist: Nutritionist })[] = [];
  for (const l of links) {
    const nut = await getNutritionist(l.nutritionistId);
    if (nut) out.push({ ...l, nutritionist: nut });
  }
  return out.sort((a, b) => a.nutritionist.name.localeCompare(b.nutritionist.name));
}

export async function listNutritionLinksForNutritionist(nutritionistId: string): Promise<NutritionistLink[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutritionist_links").select("*").eq("nutritionist_id", nutritionistId).eq("active", true);
    if (!isMissing(error) && !error) return (data ?? []).map(mapLink);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.links.filter((l) => l.nutritionistId === nutritionistId && l.active);
}

// ---------- Referrals ----------
export async function addReferral(input: Omit<NutritionReferral, "id" | "createdAt" | "status"> & { status?: "aberto" | "atendido" }): Promise<NutritionReferral> {
  const ref: NutritionReferral = {
    id: uuid(), createdAt: new Date().toISOString(), status: input.status ?? "aberto",
    doctorId: input.doctorId, doctorName: input.doctorName ?? null, nutritionistId: input.nutritionistId ?? null,
    patientKey: input.patientKey, patientName: input.patientName ?? null,
    reason: input.reason ?? null, objective: input.objective ?? null, restrictions: input.restrictions ?? null,
    priority: input.priority ?? "normal", notes: input.notes ?? null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_referrals").insert({
      id: ref.id, doctor_id: ref.doctorId, doctor_name: ref.doctorName, nutritionist_id: ref.nutritionistId,
      patient_key: ref.patientKey, patient_name: ref.patientName, reason: ref.reason, objective: ref.objective,
      restrictions: ref.restrictions, priority: ref.priority, notes: ref.notes, status: ref.status, created_at: ref.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return ref; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.referrals.push(ref);
  await writeLocal(db);
  return ref;
}

export async function listReferralsForDoctorIds(doctorIds: string[]): Promise<NutritionReferral[]> {
  if (doctorIds.length === 0) return [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_referrals").select("*").in("doctor_id", doctorIds).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapReferral);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.filter((r) => doctorIds.includes(r.doctorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReferralsForPatient(patientKey: string): Promise<NutritionReferral[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_referrals").select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapReferral);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.referrals.filter((r) => r.patientKey === patientKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setReferralStatus(id: string, status: "aberto" | "atendido"): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_referrals").update({ status }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const db = await readLocal();
  const r = db.referrals.find((x) => x.id === id);
  if (r) { r.status = status; await writeLocal(db); }
}

// ---------- Consultations ----------
export async function addConsultation(input: Omit<NutritionConsultation, "id" | "createdAt">): Promise<NutritionConsultation> {
  const c: NutritionConsultation = { id: uuid(), createdAt: new Date().toISOString(), ...input };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("nutrition_consultations").insert({
      id: c.id, nutritionist_id: c.nutritionistId, nutritionist_name: c.nutritionistName, doctor_id: c.doctorId,
      patient_key: c.patientKey, patient_name: c.patientName, assessment: c.assessment, plan: c.plan,
      shared_with_patient: c.sharedWithPatient, document_id: c.documentId, created_at: c.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return c; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.consultations.push(c);
  await writeLocal(db);
  return c;
}

export async function listConsultationsForPatient(patientKey: string): Promise<NutritionConsultation[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("nutrition_consultations").select("*").eq("patient_key", patientKey).order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapConsult);
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.consultations.filter((c) => c.patientKey === patientKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
