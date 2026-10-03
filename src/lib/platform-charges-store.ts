import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  computePlatformFeeCents,
  type PlatformActorKind,
  type PlatformChargeKind,
  type PlatformChargeStatus,
  type ProfessionalFeeRule,
} from "./platform-fees";

export interface PlatformCharge {
  id: string;
  actorKind: PlatformActorKind;
  professionalId: string;
  professionalName: string;
  kind: PlatformChargeKind;
  sourceId: string;
  amountCents: number;
  status: PlatformChargeStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "platform-charges.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

async function readLocal(): Promise<PlatformCharge[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as PlatformCharge[];
  } catch {
    return [];
  }
}
async function writeLocal(list: PlatformCharge[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

function mapRow(r: Record<string, unknown>): PlatformCharge {
  return {
    id: String(r.id),
    actorKind: (r.actor_kind as PlatformActorKind) || (r.actorKind as PlatformActorKind) || "psychology",
    professionalId: String(r.professional_id ?? r.professionalId),
    professionalName: String(r.professional_name ?? r.professionalName ?? ""),
    kind: (r.kind as PlatformChargeKind) || "atendimento",
    sourceId: String(r.source_id ?? r.sourceId ?? ""),
    amountCents: Number(r.amount_cents ?? r.amountCents ?? 0) || 0,
    status: (r.status as PlatformChargeStatus) || "due",
    note: (r.note as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? new Date().toISOString()),
  };
}

function toRow(c: PlatformCharge): Record<string, unknown> {
  return {
    id: c.id,
    actor_kind: c.actorKind,
    professional_id: c.professionalId,
    professional_name: c.professionalName,
    kind: c.kind,
    source_id: c.sourceId,
    amount_cents: c.amountCents,
    status: c.status,
    note: c.note ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export async function listPlatformCharges(filter?: { professionalId?: string; status?: PlatformChargeStatus }): Promise<PlatformCharge[]> {
  let list: PlatformCharge[] = [];
  if (active()) {
    const s = getSupabaseAdmin()!;
    let q = s.from("platform_charges").select("*").order("created_at", { ascending: false });
    if (filter?.professionalId) q = q.eq("professional_id", filter.professionalId);
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (!isMissing(error) && !error) list = (data ?? []).map(mapRow);
    else if (isMissing(error)) tableMissing = true;
  }
  if (!active() || list.length === 0) {
    list = await readLocal();
    if (filter?.professionalId) list = list.filter((c) => c.professionalId === filter.professionalId);
    if (filter?.status) list = list.filter((c) => c.status === filter.status);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return list;
}

export async function findChargeBySource(professionalId: string, sourceId: string): Promise<PlatformCharge | null> {
  const list = await listPlatformCharges({ professionalId });
  return list.find((c) => c.sourceId === sourceId) ?? null;
}

export async function recordPlatformCharge(input: {
  actorKind: PlatformActorKind;
  professionalId: string;
  professionalName: string;
  kind: PlatformChargeKind;
  sourceId: string;
  rule: ProfessionalFeeRule;
  priceCents?: number;
  note?: string | null;
}): Promise<PlatformCharge | null> {
  const amountCents = computePlatformFeeCents(input.rule, input.kind, input.priceCents ?? 0);
  if (amountCents <= 0) return null;
  const existing = await findChargeBySource(input.professionalId, input.sourceId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const row: PlatformCharge = {
    id: uuid(),
    actorKind: input.actorKind,
    professionalId: input.professionalId,
    professionalName: input.professionalName,
    kind: input.kind,
    sourceId: input.sourceId,
    amountCents,
    status: "due",
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { error } = await s.from("platform_charges").insert(toRow(row));
    if (!isMissing(error)) {
      if (error) throw error;
      return row;
    }
    tableMissing = true;
  }
  const list = await readLocal();
  list.unshift(row);
  await writeLocal(list);
  return row;
}

export async function setPlatformChargeStatus(id: string, status: PlatformChargeStatus): Promise<PlatformCharge | null> {
  const now = new Date().toISOString();
  if (active()) {
    const s = getSupabaseAdmin()!;
    const { data, error } = await s.from("platform_charges").update({ status, updated_at: now }).eq("id", id).select("*").maybeSingle();
    if (!isMissing(error) && !error) return data ? mapRow(data) : null;
    if (isMissing(error)) tableMissing = true;
  }
  const list = await readLocal();
  const row = list.find((c) => c.id === id);
  if (!row) return null;
  row.status = status;
  row.updatedAt = now;
  await writeLocal(list);
  return row;
}

export function chargesTotals(list: PlatformCharge[]) {
  const due = list.filter((c) => c.status === "due" || c.status === "declared").reduce((s, c) => s + c.amountCents, 0);
  const received = list.filter((c) => c.status === "received").reduce((s, c) => s + c.amountCents, 0);
  return { dueCents: due, receivedCents: received, count: list.length };
}
