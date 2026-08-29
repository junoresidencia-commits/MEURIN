import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type ShareStatus = "active" | "revoked";

export interface PatientDoctorShare {
  id: string;
  patientKey: string;
  patientName: string | null;
  fromDoctorId: string;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorId: string;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: ShareStatus;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface DoctorPeer {
  id: string;
  doctorId: string;
  peerId: string;
  active: boolean;
  createdAt: string;
}

export interface ChartAuditEntry {
  id: string;
  doctorId: string;
  doctorName: string | null;
  patientKey: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "patient-shares.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { shares: PatientDoctorShare[]; peers: DoctorPeer[]; audit: ChartAuditEntry[] };

async function readLocal(): Promise<LocalDb> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb; }
  catch { return { shares: [], peers: [], audit: [] }; }
}
async function writeLocal(db: LocalDb) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function mapShare(r: Record<string, unknown>): PatientDoctorShare {
  return {
    id: String(r.id),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: (r.patient_name as string) ?? (r.patientName as string) ?? null,
    fromDoctorId: String(r.from_doctor_id ?? r.fromDoctorId),
    fromDoctorName: (r.from_doctor_name as string) ?? (r.fromDoctorName as string) ?? null,
    fromSpecialty: (r.from_specialty as string) ?? (r.fromSpecialty as string) ?? null,
    toDoctorId: String(r.to_doctor_id ?? r.toDoctorId),
    toDoctorName: (r.to_doctor_name as string) ?? (r.toDoctorName as string) ?? null,
    toSpecialty: (r.to_specialty as string) ?? (r.toSpecialty as string) ?? null,
    reason: (r.reason as string) ?? null,
    status: ((r.status as ShareStatus) || "active"),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    revokedAt: (r.revoked_at as string) ?? (r.revokedAt as string) ?? null,
    revokedBy: (r.revoked_by as string) ?? (r.revokedBy as string) ?? null,
  };
}

export async function getShare(id: string): Promise<PatientDoctorShare | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_doctor_shares").select("*").eq("id", id).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapShare(data as Record<string, unknown>) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.shares.find((x) => x.id === id) ?? null;
}

export async function findActiveShare(doctorId: string, patientKey: string): Promise<PatientDoctorShare | null> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_doctor_shares").select("*")
      .eq("to_doctor_id", doctorId).eq("patient_key", key).eq("status", "active").limit(1).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapShare(data as Record<string, unknown>) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.shares.find((x) => x.toDoctorId === doctorId && x.patientKey === key && x.status === "active") ?? null;
}

export async function hasActiveShare(doctorId: string, patientKey: string): Promise<boolean> {
  return Boolean(await findActiveShare(doctorId, patientKey));
}

export async function hasActiveShareAny(doctorId: string, patientKeys: string[]): Promise<boolean> {
  const keys = [...new Set(patientKeys.map((k) => k.toLowerCase().trim()).filter(Boolean))];
  for (const key of keys) {
    if (await hasActiveShare(doctorId, key)) return true;
  }
  return false;
}

export async function listSharesForDoctor(doctorId: string): Promise<{ incoming: PatientDoctorShare[]; outgoing: PatientDoctorShare[] }> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_doctor_shares").select("*")
      .or(`to_doctor_id.eq.${doctorId},from_doctor_id.eq.${doctorId}`)
      .order("created_at", { ascending: false });
    if (!isMissing(error) && !error) {
      const all = (data ?? []).map((r) => mapShare(r as Record<string, unknown>));
      return {
        incoming: all.filter((x) => x.toDoctorId === doctorId),
        outgoing: all.filter((x) => x.fromDoctorId === doctorId),
      };
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  const all = db.shares.filter((x) => x.toDoctorId === doctorId || x.fromDoctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    incoming: all.filter((x) => x.toDoctorId === doctorId),
    outgoing: all.filter((x) => x.fromDoctorId === doctorId),
  };
}

export async function listActiveSharesForPatient(patientKey: string): Promise<PatientDoctorShare[]> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_doctor_shares").select("*")
      .eq("patient_key", key).eq("status", "active").order("created_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map((r) => mapShare(r as Record<string, unknown>));
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.shares.filter((x) => x.patientKey === key && x.status === "active");
}

export async function createShare(input: Omit<PatientDoctorShare, "id" | "createdAt" | "status" | "revokedAt" | "revokedBy">): Promise<PatientDoctorShare> {
  const row: PatientDoctorShare = {
    ...input,
    id: uuid(),
    patientKey: input.patientKey.toLowerCase().trim(),
    status: "active",
    createdAt: new Date().toISOString(),
    revokedAt: null,
    revokedBy: null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("patient_doctor_shares").insert({
      id: row.id,
      patient_key: row.patientKey,
      patient_name: row.patientName,
      from_doctor_id: row.fromDoctorId,
      from_doctor_name: row.fromDoctorName,
      from_specialty: row.fromSpecialty,
      to_doctor_id: row.toDoctorId,
      to_doctor_name: row.toDoctorName,
      to_specialty: row.toSpecialty,
      reason: row.reason,
      status: row.status,
      created_at: row.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return row; }
    tableMissing = true;
  }
  const db = await readLocal();
  db.shares.push(row);
  await writeLocal(db);
  return row;
}

export async function revokeShare(id: string, byDoctorId: string): Promise<PatientDoctorShare | null> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("patient_doctor_shares")
      .update({ status: "revoked", revoked_at: now, revoked_by: byDoctorId })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (!isMissing(error) && !error) return data ? mapShare(data as Record<string, unknown>) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  const row = db.shares.find((x) => x.id === id);
  if (!row) return null;
  row.status = "revoked";
  row.revokedAt = now;
  row.revokedBy = byDoctorId;
  await writeLocal(db);
  return row;
}

export async function listPeers(doctorId: string): Promise<DoctorPeer[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("doctor_peers").select("*").eq("doctor_id", doctorId).eq("active", true);
    if (!isMissing(error) && !error) {
      return (data ?? []).map((r) => ({
        id: String(r.id), doctorId: String(r.doctor_id), peerId: String(r.peer_id),
        active: r.active !== false, createdAt: String(r.created_at),
      }));
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.peers.filter((p) => p.doctorId === doctorId && p.active);
}

export async function upsertPeer(doctorId: string, peerId: string): Promise<void> {
  if (doctorId === peerId) return;
  if (active()) {
    const s = getSupabaseAdmin()!;
    const existing = await s.from("doctor_peers").select("id").eq("doctor_id", doctorId).eq("peer_id", peerId).maybeSingle();
    if (existing.data) {
      await s.from("doctor_peers").update({ active: true, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
      return;
    }
    const { error } = await s.from("doctor_peers").insert({
      id: uuid(), doctor_id: doctorId, peer_id: peerId, active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  const found = db.peers.find((p) => p.doctorId === doctorId && p.peerId === peerId);
  if (found) found.active = true;
  else db.peers.push({ id: uuid(), doctorId, peerId, active: true, createdAt: new Date().toISOString() });
  await writeLocal(db);
}

export async function setPeerActive(doctorId: string, peerId: string, activeFlag: boolean): Promise<void> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("doctor_peers").update({ active: activeFlag, updated_at: new Date().toISOString() })
      .eq("doctor_id", doctorId).eq("peer_id", peerId);
    if (!isMissing(error)) { if (error) throw error; return; }
    tableMissing = true;
  }
  const db = await readLocal();
  const found = db.peers.find((p) => p.doctorId === doctorId && p.peerId === peerId);
  if (found) found.active = activeFlag;
  await writeLocal(db);
}

export async function writeAudit(input: { doctorId: string; doctorName?: string | null; patientKey?: string | null; action: string; detail?: string | null }): Promise<void> {
  const row: ChartAuditEntry = {
    id: uuid(),
    doctorId: input.doctorId,
    doctorName: input.doctorName ?? null,
    patientKey: input.patientKey ? input.patientKey.toLowerCase().trim() : null,
    action: input.action,
    detail: input.detail ?? null,
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("chart_audit_log").insert({
      id: row.id, doctor_id: row.doctorId, doctor_name: row.doctorName,
      patient_key: row.patientKey, action: row.action, detail: row.detail, created_at: row.createdAt,
    });
    if (!isMissing(error)) { if (error) return; }
    else tableMissing = true;
  }
  const db = await readLocal();
  db.audit.unshift(row);
  db.audit = db.audit.slice(0, 2000);
  await writeLocal(db);
}

export async function listAudit(patientKey: string): Promise<ChartAuditEntry[]> {
  const key = patientKey.toLowerCase().trim();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("chart_audit_log").select("*").eq("patient_key", key).order("created_at", { ascending: false }).limit(80);
    if (!isMissing(error) && !error) {
      return (data ?? []).map((r) => ({
        id: String(r.id), doctorId: String(r.doctor_id), doctorName: (r.doctor_name as string) ?? null,
        patientKey: (r.patient_key as string) ?? null, action: String(r.action),
        detail: (r.detail as string) ?? null, createdAt: String(r.created_at),
      }));
    }
    if (isMissing(error)) tableMissing = true;
  }
  const db = await readLocal();
  return db.audit.filter((a) => a.patientKey === key).slice(0, 80);
}
