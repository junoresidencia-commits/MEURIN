import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";

export type CareChatRole = "nutrition" | "psychology" | "nursing" | "cardiology" | "endocrinology" | "physician";
export type CareMessageSender = "patient" | "professional";

export interface CareMessage {
  id: string;
  role: CareChatRole;
  professionalId: string;
  patientKey: string;
  sender: CareMessageSender;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "care-messages.json");
let tableMissing = false;

function active() { return Boolean(getSupabaseAdmin()) && !tableMissing; }
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

async function readLocal(): Promise<CareMessage[]> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")) as CareMessage[]; }
  catch { return []; }
}
async function writeLocal(list: CareMessage[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): CareMessage {
  return {
    id: String(r.id),
    role: (r.role as CareChatRole) || "nutrition",
    professionalId: String(r.professional_id ?? r.professionalId),
    patientKey: String(r.patient_key ?? r.patientKey),
    sender: (r.sender as CareMessageSender) || "patient",
    body: String(r.body ?? ""),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    readAt: (r.read_at as string) ?? (r.readAt as string) ?? null,
  };
}

export async function addCareMessage(input: Omit<CareMessage, "id" | "createdAt" | "readAt">): Promise<CareMessage> {
  const row: CareMessage = {
    id: uuid(),
    role: input.role,
    professionalId: input.professionalId,
    patientKey: input.patientKey,
    sender: input.sender,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("care_messages").insert({
      id: row.id,
      role: row.role,
      professional_id: row.professionalId,
      patient_key: row.patientKey,
      sender: row.sender,
      body: row.body,
      created_at: row.createdAt,
    });
    if (!isMissing(error)) { if (error) throw error; return row; }
    tableMissing = true;
  }
  const list = await readLocal();
  list.push(row);
  await writeLocal(list);
  return row;
}

export async function listCareMessages(role: CareChatRole, professionalId: string, patientKey: string, limit = 80): Promise<CareMessage[]> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("care_messages")
      .select("*")
      .eq("role", role)
      .eq("professional_id", professionalId)
      .eq("patient_key", patientKey)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (!isMissing(error) && !error) return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list
    .filter((m) => m.role === role && m.professionalId === professionalId && m.patientKey === patientKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit);
}

export async function markCareMessagesRead(role: CareChatRole, professionalId: string, patientKey: string, reader: CareMessageSender): Promise<void> {
  const from = reader === "professional" ? "patient" : "professional";
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("care_messages")
      .update({ read_at: now })
      .eq("role", role)
      .eq("professional_id", professionalId)
      .eq("patient_key", patientKey)
      .eq("sender", from)
      .is("read_at", null);
    if (!isMissing(error)) { if (error) return; }
    else tableMissing = true;
  }
  if (!active()) {
    const list = await readLocal();
    let changed = false;
    for (const m of list) {
      if (m.role === role && m.professionalId === professionalId && m.patientKey === patientKey && m.sender === from && !m.readAt) {
        m.readAt = now;
        changed = true;
      }
    }
    if (changed) await writeLocal(list);
  }
}

export async function unreadCareCountsForProfessional(professionalId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("care_messages")
      .select("patient_key")
      .eq("professional_id", professionalId)
      .eq("sender", "patient")
      .is("read_at", null);
    if (!isMissing(error) && !error) {
      for (const r of data ?? []) {
        const k = String((r as { patient_key: string }).patient_key);
        counts[k] = (counts[k] || 0) + 1;
      }
      return counts;
    }
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  for (const m of list) {
    if (m.professionalId === professionalId && m.sender === "patient" && !m.readAt) {
      counts[m.patientKey] = (counts[m.patientKey] || 0) + 1;
    }
  }
  return counts;
}

export async function unreadCareCountForPatient(patientKeys: string[]): Promise<number> {
  const keys = new Set(patientKeys.filter(Boolean));
  if (keys.size === 0) return 0;
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("care_messages")
      .select("id, patient_key")
      .eq("sender", "professional")
      .is("read_at", null)
      .in("patient_key", [...keys]);
    if (!isMissing(error) && !error) return (data ?? []).length;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.filter((m) => keys.has(m.patientKey) && m.sender === "professional" && !m.readAt).length;
}

export async function unreadInThread(role: CareChatRole, professionalId: string, patientKey: string, sender: CareMessageSender): Promise<number> {
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { count, error } = await s.from("care_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", role)
      .eq("professional_id", professionalId)
      .eq("patient_key", patientKey)
      .eq("sender", sender)
      .is("read_at", null);
    if (!isMissing(error) && !error) return count ?? 0;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return list.filter((m) => m.role === role && m.professionalId === professionalId && m.patientKey === patientKey && m.sender === sender && !m.readAt).length;
}
