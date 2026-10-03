import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type CareKind = "psychology" | "nursing" | "nutrition";
export type CareRoomStatus = "open" | "closed";

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

async function readLocal(): Promise<CareRoom[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as CareRoom[];
  } catch {
    return [];
  }
}
async function writeLocal(list: CareRoom[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): CareRoom {
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

export async function findReusableRoom(professionalId: string, patientKey: string): Promise<CareRoom | null> {
  const cutoff = Date.now() - REUSE_MS;
  const open = await listOpenRoomsForProfessional(professionalId);
  return (
    open.find((r) => {
      const same = r.patientKey === patientKey || (r.patientEmail && r.patientEmail.toLowerCase() === patientKey.toLowerCase());
      return same && new Date(r.updatedAt).getTime() >= cutoff;
    }) ?? null
  );
}

export async function createCareRoom(input: Omit<CareRoom, "id" | "meetingRoomId" | "createdAt" | "updatedAt" | "status">): Promise<CareRoom> {
  const now = new Date().toISOString();
  const room: CareRoom = {
    ...input,
    id: uuid(),
    meetingRoomId: uuid(),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("care_rooms").insert(toRow(room));
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
