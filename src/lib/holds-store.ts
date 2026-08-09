import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import type { AppointmentHold } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "holds.json");
const HOLD_MINUTES = 10;
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

async function readLocal(): Promise<AppointmentHold[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as AppointmentHold[];
  } catch {
    return [];
  }
}
async function writeLocal(list: AppointmentHold[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

/** Starts (ISO) com reserva ativa (não expirada), opcionalmente excluindo um holder. */
export async function activeHoldStarts(doctorId: string, exceptHolder?: string): Promise<Set<string>> {
  const nowIso = new Date().toISOString();
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { data, error } = await supabase
      .from("appointment_holds")
      .select("slot_start, holder, expires_at")
      .eq("doctor_id", doctorId)
      .gt("expires_at", nowIso);
    if (!isMissing(error) && !error) {
      return new Set(
        (data ?? [])
          .filter((r) => !exceptHolder || String(r.holder) !== exceptHolder)
          .map((r) => new Date(String(r.slot_start)).toISOString())
      );
    }
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  return new Set(
    list
      .filter((h) => h.doctorId === doctorId && h.expiresAt > nowIso && (!exceptHolder || h.holder !== exceptHolder))
      .map((h) => new Date(h.slotStart).toISOString())
  );
}

/** Verifica se o horário está livre de reservas de OUTRO holder. */
export async function isHeldByOther(doctorId: string, slotStart: string, holder: string): Promise<boolean> {
  const starts = await activeHoldStarts(doctorId, holder);
  return starts.has(new Date(slotStart).toISOString());
}

/** Cria uma reserva temporária. O chamador deve ter verificado disponibilidade antes. */
export async function createHold(doctorId: string, slotStart: string, holder: string): Promise<AppointmentHold> {
  const now = Date.now();
  const hold: AppointmentHold = {
    id: uuid(),
    doctorId,
    slotStart: new Date(slotStart).toISOString(),
    holder,
    expiresAt: new Date(now + HOLD_MINUTES * 60 * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    const { error } = await supabase.from("appointment_holds").insert({
      id: hold.id,
      doctor_id: hold.doctorId,
      slot_start: hold.slotStart,
      holder: hold.holder,
      expires_at: hold.expiresAt,
      created_at: hold.createdAt,
    });
    if (!isMissing(error)) {
      if (error) throw error;
      return hold;
    }
    tableMissing = true;
  }
  const list = await readLocal();
  list.push(hold);
  await writeLocal(list);
  return hold;
}

/** Libera reservas de um horário (por holder específico ou todas). */
export async function releaseHold(doctorId: string, slotStart: string, holder?: string): Promise<void> {
  const iso = new Date(slotStart).toISOString();
  if (active()) {
    const supabase = getSupabaseAdmin()!;
    let del = supabase.from("appointment_holds").delete().eq("doctor_id", doctorId).eq("slot_start", iso);
    if (holder) del = del.eq("holder", holder);
    const { error } = await del;
    if (!isMissing(error)) {
      if (error) throw error;
      return;
    }
    tableMissing = true;
  }
  const list = await readLocal();
  await writeLocal(list.filter((h) => !(h.doctorId === doctorId && new Date(h.slotStart).toISOString() === iso && (!holder || h.holder === holder))));
}
