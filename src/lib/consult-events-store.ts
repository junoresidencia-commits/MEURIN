import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ConsultEventKind } from "@/lib/consult-call";

export type ConsultCallEvent = {
  id: string;
  roomId: string;
  role: "doctor" | "patient";
  kind: ConsultEventKind;
  iceState?: string;
  browser?: string;
  turn?: boolean;
  phase?: string;
  createdAt: string;
};

const FILE = path.join(process.cwd(), "data", "consult-events.json");
const recent = new Map<string, number[]>();

export function allowConsultEvent(roomId: string, now = Date.now(), windowMs = 60_000, max = 40): boolean {
  const list = (recent.get(roomId) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    recent.set(roomId, list);
    return false;
  }
  list.push(now);
  recent.set(roomId, list);
  return true;
}

export async function appendConsultEvent(event: Omit<ConsultCallEvent, "id" | "createdAt">): Promise<ConsultCallEvent> {
  const row: ConsultCallEvent = {
    ...event,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const sb = getSupabaseAdmin();
  if (sb) {
    const { error } = await sb.from("consult_call_events").insert({
      id: row.id,
      room_id: row.roomId,
      role: row.role,
      kind: row.kind,
      ice_state: row.iceState ?? null,
      browser: row.browser ?? null,
      turn: row.turn ?? null,
      phase: row.phase ?? null,
      created_at: row.createdAt,
    });
    if (error) console.error("[consult-events] insert", error.message || error);
    return row;
  }
  let list: ConsultCallEvent[] = [];
  try {
    list = JSON.parse(await fs.readFile(FILE, "utf8")) as ConsultCallEvent[];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.push(row);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list.slice(-400), null, 2));
  return row;
}
