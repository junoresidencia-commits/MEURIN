import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  courtesyKeysMatch,
  isCourtesyKind,
  normalizeCourtesyKey,
  type CourtesyKind,
  type CourtesyStatus,
} from "./courtesy";

export interface CourtesyCredit {
  id: string;
  doctorId: string;
  patientKey: string;
  patientName: string;
  patientEmail: string | null;
  kind: CourtesyKind;
  status: CourtesyStatus;
  bookingId: string | null;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "courtesy-credits.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

async function readLocal(): Promise<CourtesyCredit[]> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as CourtesyCredit[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function writeLocal(list: CourtesyCredit[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): CourtesyCredit {
  const kind = isCourtesyKind(r.kind) ? r.kind : "gratis";
  const status = r.status === "used" || r.status === "revoked" ? r.status : "open";
  return {
    id: String(r.id),
    doctorId: String(r.doctor_id ?? r.doctorId),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: String(r.patient_name ?? r.patientName ?? "Paciente"),
    patientEmail: (r.patient_email as string) ?? (r.patientEmail as string) ?? null,
    kind,
    status,
    bookingId: (r.booking_id as string) ?? (r.bookingId as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    usedAt: (r.used_at as string) ?? (r.usedAt as string) ?? null,
    revokedAt: (r.revoked_at as string) ?? (r.revokedAt as string) ?? null,
  };
}

function toRow(c: CourtesyCredit) {
  return {
    id: c.id,
    doctor_id: c.doctorId,
    patient_key: c.patientKey,
    patient_name: c.patientName,
    patient_email: c.patientEmail,
    kind: c.kind,
    status: c.status,
    booking_id: c.bookingId,
    created_at: c.createdAt,
    used_at: c.usedAt,
    revoked_at: c.revokedAt,
  };
}

export async function listCourtesyCredits(doctorId: string): Promise<CourtesyCredit[]> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!
      .from("courtesy_credits")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        tableMissing = true;
        return listCourtesyCredits(doctorId);
      }
      throw error;
    }
    return (data || []).map((r) => mapRow(r as Record<string, unknown>));
  }
  return (await readLocal()).filter((c) => c.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listCourtesyForPatient(doctorId: string, patientKey: string): Promise<CourtesyCredit[]> {
  const all = await listCourtesyCredits(doctorId);
  return all.filter((c) => courtesyKeysMatch(c, patientKey));
}

export async function findOpenCourtesy(doctorId: string, patientKey: string): Promise<CourtesyCredit | null> {
  const list = await listCourtesyForPatient(doctorId, patientKey);
  return list.find((c) => c.status === "open") || null;
}

export async function grantCourtesyCredit(input: {
  doctorId: string;
  patientKey: string;
  patientName: string;
  patientEmail?: string | null;
  kind: CourtesyKind;
}): Promise<{ credit: CourtesyCredit; alreadyOpen: boolean }> {
  const patientKey = normalizeCourtesyKey(input.patientKey) || input.patientKey;
  const patientEmail = input.patientEmail ? normalizeCourtesyKey(input.patientEmail) : null;
  const existing = await findOpenCourtesy(input.doctorId, patientKey);
  if (existing) {
    if (existing.kind === input.kind) return { credit: existing, alreadyOpen: true };
    const updated: CourtesyCredit = { ...existing, kind: input.kind };
    await saveCredit(updated);
    return { credit: updated, alreadyOpen: true };
  }
  const credit: CourtesyCredit = {
    id: uuid(),
    doctorId: input.doctorId,
    patientKey,
    patientName: input.patientName.trim() || "Paciente",
    patientEmail,
    kind: input.kind,
    status: "open",
    bookingId: null,
    createdAt: new Date().toISOString(),
    usedAt: null,
    revokedAt: null,
  };
  await insertCredit(credit);
  return { credit, alreadyOpen: false };
}

export async function revokeCourtesyCredit(doctorId: string, id: string): Promise<CourtesyCredit | null> {
  const list = await listCourtesyCredits(doctorId);
  const credit = list.find((c) => c.id === id);
  if (!credit || credit.status !== "open") return null;
  const updated: CourtesyCredit = { ...credit, status: "revoked", revokedAt: new Date().toISOString() };
  await saveCredit(updated);
  return updated;
}

export async function consumeCourtesyCredit(
  doctorId: string,
  patientKey: string,
  bookingId: string
): Promise<CourtesyCredit | null> {
  const open = await findOpenCourtesy(doctorId, patientKey);
  if (!open) return null;
  const updated: CourtesyCredit = {
    ...open,
    status: "used",
    bookingId,
    usedAt: new Date().toISOString(),
  };
  await saveCredit(updated);
  return updated;
}

async function insertCredit(credit: CourtesyCredit) {
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("courtesy_credits").insert(toRow(credit));
    if (error) {
      if (isMissingTable(error)) {
        tableMissing = true;
        return insertCredit(credit);
      }
      throw error;
    }
    return;
  }
  const list = await readLocal();
  await writeLocal([credit, ...list]);
}

async function saveCredit(credit: CourtesyCredit) {
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("courtesy_credits").update(toRow(credit)).eq("id", credit.id);
    if (error) {
      if (isMissingTable(error)) {
        tableMissing = true;
        return saveCredit(credit);
      }
      throw error;
    }
    return;
  }
  const list = await readLocal();
  await writeLocal(list.map((c) => (c.id === credit.id ? credit : c)));
}
