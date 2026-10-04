import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type CareKind = "psychology" | "nursing" | "nutrition";
export type CareRoomStatus = "open" | "closed";
export type CarePaymentStatus = "free" | "unpaid" | "declared" | "confirmed";

export interface CareRoom {
  id: string;
  meetingRoomId: string;
  kind: CareKind;
  professionalId: string;
  professionalName: string;
  patientKey: string;
  patientName: string;
  patientEmail?: string | null;
  status: CareRoomStatus;
  priceCents: number;
  pixCopiaCola?: string | null;
  pixHolderName?: string | null;
  paymentStatus: CarePaymentStatus;
  isReturn?: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "care-rooms.json");
const REUSE_MS = 12 * 60 * 60 * 1000;
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

function missingColumnName(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code !== "PGRST204" && error.code !== "42703" && !/column|schema cache/i.test(error.message || "")) return null;
  const msg = error.message || "";
  let m = msg.match(/find the '([^']+)' column/i);
  if (m) return m[1];
  m = msg.match(/column "?([a-z0-9_]+)"? .*does not exist/i);
  return m ? m[1] : null;
}

async function insertCareRoomResilient(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }> {
  const supabase = getSupabaseAdmin()!;
  const current = { ...row };
  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from("care_rooms").insert(current);
    if (!error) return { error: null };
    const col = missingColumnName(error);
    if (!col || !(col in current)) return { error };
    delete current[col];
  }
  return { error: { message: "Não foi possível gravar a sala." } };
}

async function readLocal(): Promise<CareRoom[]> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Record<string, unknown>[];
    return Array.isArray(raw) ? raw.map(mapRow) : [];
  } catch {
    return [];
  }
}
async function writeLocal(list: CareRoom[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapPaymentStatus(value: unknown, priceCents: number): CarePaymentStatus {
  if (value === "free" || value === "unpaid" || value === "declared" || value === "confirmed") return value;
  return priceCents > 0 ? "unpaid" : "free";
}

function mapRow(r: Record<string, unknown>): CareRoom {
  const priceCents = Number(r.price_cents ?? r.priceCents ?? 0) || 0;
  return {
    id: String(r.id),
    meetingRoomId: String(r.meeting_room_id ?? r.meetingRoomId),
    kind: (r.kind as CareKind) || "psychology",
    professionalId: String(r.professional_id ?? r.professionalId),
    professionalName: String(r.professional_name ?? r.professionalName ?? ""),
    patientKey: String(r.patient_key ?? r.patientKey),
    patientName: String(r.patient_name ?? r.patientName ?? "Paciente"),
    patientEmail: (r.patient_email as string) ?? (r.patientEmail as string) ?? null,
    status: (r.status as CareRoomStatus) || "open",
    priceCents,
    pixCopiaCola: (r.pix_copia_cola as string) ?? (r.pixCopiaCola as string) ?? null,
    pixHolderName: (r.pix_holder_name as string) ?? (r.pixHolderName as string) ?? null,
    paymentStatus: mapPaymentStatus(r.payment_status ?? r.paymentStatus, priceCents),
    isReturn: r.is_return === true || r.isReturn === true,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}

function toRow(room: CareRoom): Record<string, unknown> {
  return {
    id: room.id,
    meeting_room_id: room.meetingRoomId,
    kind: room.kind,
    professional_id: room.professionalId,
    professional_name: room.professionalName,
    patient_key: room.patientKey,
    patient_name: room.patientName,
    patient_email: room.patientEmail ?? null,
    status: room.status,
    price_cents: room.priceCents,
    pix_copia_cola: room.pixCopiaCola ?? null,
    pix_holder_name: room.pixHolderName ?? null,
    payment_status: room.paymentStatus,
    is_return: room.isReturn === true,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  };
}

export const CARE_META: Record<CareKind, { label: string; path: string; login: string; area: string }> = {
  psychology: { label: "Psicólogo(a)", path: "/psicologo/painel", login: "/psicologo/login", area: "Psicologia" },
  nursing: { label: "Enfermeiro(a)", path: "/enfermeiro/painel", login: "/enfermeiro/login", area: "Enfermagem" },
  nutrition: { label: "Nutricionista", path: "/nutricionista/painel", login: "/nutricionista/login", area: "Nutrição" },
};

export async function getCareRoomByMeetingId(meetingRoomId: string): Promise<CareRoom | null> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("care_rooms").select("*").eq("meeting_room_id", meetingRoomId).maybeSingle();
    if (!isMissing(error) && !error) return data ? mapRow(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.find((r) => r.meetingRoomId === meetingRoomId) ?? null;
}

export async function listOpenRoomsForProfessional(professionalId: string): Promise<CareRoom[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s
      .from("care_rooms")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("status", "open")
      .order("updated_at", { ascending: false });
    if (!isMissing(error) && !error) return (data ?? []).map(mapRow);
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list
    .filter((r) => r.professionalId === professionalId && r.status === "open")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listOpenRoomsForPatientKeys(keys: string[]): Promise<CareRoom[]> {
  const set = new Set(keys.map((k) => k.toLowerCase().trim()).filter(Boolean));
  if (set.size === 0) return [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("care_rooms").select("*").eq("status", "open").order("updated_at", { ascending: false });
    if (!isMissing(error) && !error) {
      return (data ?? []).map(mapRow).filter((r) => matchesPatient(r, set));
    }
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.filter((r) => r.status === "open" && matchesPatient(r, set)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function matchesPatient(room: CareRoom, keys: Set<string>) {
  const email = (room.patientEmail || "").toLowerCase().trim();
  return keys.has(room.patientKey.toLowerCase().trim()) || (email && keys.has(email));
}

export async function findReusableRoom(professionalId: string, patientKey: string, isReturn?: boolean): Promise<CareRoom | null> {
  const cutoff = Date.now() - REUSE_MS;
  const open = await listOpenRoomsForProfessional(professionalId);
  const needle = patientKey.toLowerCase().trim();
  return (
    open.find((r) => {
      const same =
        r.patientKey.toLowerCase().trim() === needle ||
        (r.patientEmail && r.patientEmail.toLowerCase().trim() === needle);
      const sameVisit = (r.isReturn === true) === (isReturn === true);
      return same && sameVisit && new Date(r.updatedAt).getTime() >= cutoff;
    }) ?? null
  );
}

export async function createCareRoom(
  input: Omit<CareRoom, "id" | "meetingRoomId" | "createdAt" | "updatedAt" | "status"> & {
    paymentStatus?: CarePaymentStatus;
    priceCents?: number;
  }
): Promise<CareRoom> {
  const now = new Date().toISOString();
  const priceCents = Math.max(0, Math.round(input.priceCents ?? 0));
  const room: CareRoom = {
    ...input,
    id: uuid(),
    meetingRoomId: uuid(),
    status: "open",
    priceCents,
    pixCopiaCola: input.pixCopiaCola ?? null,
    pixHolderName: input.pixHolderName ?? null,
    paymentStatus: input.paymentStatus ?? (priceCents > 0 ? "unpaid" : "free"),
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const { error } = await insertCareRoomResilient(toRow(room));
    if (!isMissing(error)) {
      if (error) throw error;
      return room;
    }
    tableMissing = true;
  }
  const list = await readLocal();
  list.push(room);
  await writeLocal(list);
  return room;
}

export async function updateCarePayment(
  id: string,
  patch: { paymentStatus?: CarePaymentStatus; pixCopiaCola?: string | null; pixHolderName?: string | null; priceCents?: number }
): Promise<CareRoom | null> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data: cur, error: readErr } = await s.from("care_rooms").select("*").eq("id", id).maybeSingle();
    if (!isMissing(readErr) && !readErr && cur) {
      const next = {
        payment_status: patch.paymentStatus ?? cur.payment_status,
        pix_copia_cola: patch.pixCopiaCola !== undefined ? patch.pixCopiaCola : cur.pix_copia_cola,
        pix_holder_name: patch.pixHolderName !== undefined ? patch.pixHolderName : cur.pix_holder_name,
        price_cents: patch.priceCents !== undefined ? patch.priceCents : cur.price_cents,
        updated_at: now,
      };
      const { error } = await s.from("care_rooms").update(next).eq("id", id);
      if (!isMissing(error) && !error) return mapRow({ ...cur, ...next });
      if (error && !isMissing(error)) throw error;
    }
    if (isMissing(readErr)) tableMissing = true;
  }
  const list = await readLocal();
  const room = list.find((r) => r.id === id);
  if (!room) return null;
  if (patch.paymentStatus !== undefined) room.paymentStatus = patch.paymentStatus;
  if (patch.pixCopiaCola !== undefined) room.pixCopiaCola = patch.pixCopiaCola;
  if (patch.pixHolderName !== undefined) room.pixHolderName = patch.pixHolderName;
  if (patch.priceCents !== undefined) room.priceCents = patch.priceCents;
  room.updatedAt = now;
  await writeLocal(list);
  return room;
}

export async function touchCareRoom(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("care_rooms").update({ updated_at: now }).eq("id", id);
    if (!isMissing(error)) return;
    tableMissing = true;
  }
  const list = await readLocal();
  const room = list.find((r) => r.id === id);
  if (room) {
    room.updatedAt = now;
    await writeLocal(list);
  }
}
