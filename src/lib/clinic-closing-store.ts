import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { getFeeRule, listEncounters, writeFinanceEvent } from "./clinic-finance-store";
import type {
  AdjustmentKind,
  ClinicClosing,
  ClinicClosingAdjustment,
  ClosingStatus,
} from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-closings.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = { closings: ClinicClosing[]; adjustments: ClinicClosingAdjustment[] };

async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as LocalDb;
  } catch {
    return { closings: [], adjustments: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[clinic-closing] persistência local indisponível", err);
  }
}

function mapClosing(r: Record<string, unknown>): ClinicClosing {
  const ids = r.encounter_ids ?? r.encounterIds ?? [];
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    doctorId: String(r.doctor_id ?? r.doctorId),
    code: String(r.code),
    periodFrom: String(r.period_from ?? r.periodFrom).slice(0, 10),
    periodTo: String(r.period_to ?? r.periodTo).slice(0, 10),
    encounterIds: Array.isArray(ids) ? ids.map(String) : [],
    producedCents: Number(r.produced_cents ?? r.producedCents ?? 0),
    receivedCents: Number(r.received_cents ?? r.receivedCents ?? 0),
    clinicShareCents: Number(r.clinic_share_cents ?? r.clinicShareCents ?? 0),
    doctorShareCents: Number(r.doctor_share_cents ?? r.doctorShareCents ?? 0),
    status: String(r.status ?? "closed") as ClosingStatus,
    createdBy: (r.created_by as string) ?? (r.createdBy as string) ?? null,
    paidAt: (r.paid_at as string) ?? (r.paidAt as string) ?? null,
    paidBy: (r.paid_by as string) ?? (r.paidBy as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapAdj(r: Record<string, unknown>): ClinicClosingAdjustment {
  return {
    id: String(r.id),
    closingId: String(r.closing_id ?? r.closingId),
    clinicId: String(r.clinic_id ?? r.clinicId),
    kind: String(r.kind) as AdjustmentKind,
    amountCents: Number(r.amount_cents ?? r.amountCents ?? 0),
    reason: String(r.reason || ""),
    createdByKind: (r.created_by_kind as string) ?? (r.createdByKind as string) ?? null,
    createdById: (r.created_by_id as string) ?? (r.createdById as string) ?? null,
    createdByEmail: (r.created_by_email as string) ?? (r.createdByEmail as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}

export async function listClosings(clinicId: string): Promise<ClinicClosing[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_closings").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapClosing(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).closings.filter((c) => c.clinicId === clinicId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClosing(id: string): Promise<ClinicClosing | null> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_closings").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapClosing(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).closings.find((c) => c.id === id) ?? null;
}

export async function listAdjustments(closingId: string): Promise<ClinicClosingAdjustment[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_closing_adjustments").select("*").eq("closing_id", closingId).order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapAdj(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).adjustments.filter((a) => a.closingId === closingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function nextCode(year: number): Promise<string> {
  const prefix = `MED-${year}-`;
  let used: string[] = [];
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_closings").select("code").like("code", `${prefix}%`);
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else used = [];
    } else {
      used = (data || []).map((r) => String((r as { code: string }).code));
    }
  }
  if (!active() || tableMissing) {
    used = (await readLocal()).closings.map((c) => c.code).filter((c) => c.startsWith(prefix));
  }
  let max = 0;
  for (const code of used) {
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

async function logClosingFinanceEvent(input: {
  clinicId: string;
  kind: "closing" | "payout" | "adjustment";
  entity: string;
  entityId: string;
  beforeCents?: number | null;
  afterCents?: number | null;
  reason?: string | null;
  actorKind?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
}) {
  try {
    await writeFinanceEvent({
      clinicId: input.clinicId,
      kind: input.kind,
      entity: input.entity,
      entityId: input.entityId,
      beforeCents: input.beforeCents ?? null,
      afterCents: input.afterCents ?? null,
      reason: input.reason ?? null,
      actorKind: input.actorKind ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
    });
  } catch (err) {
    console.error("[clinic-closing] histórico financeiro indisponível", err);
  }
}

export function netDoctorPayout(closing: ClinicClosing, adjustments: ClinicClosingAdjustment[]): number {
  let extra = 0;
  for (const a of adjustments) {
    if (a.kind === "debit") extra -= Math.abs(a.amountCents);
    else extra += a.amountCents;
  }
  return closing.doctorShareCents + extra;
}

function periodsOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function findOverlappingClosing(
  closings: ClinicClosing[],
  doctorId: string,
  periodFrom: string,
  periodTo: string
): ClinicClosing | null {
  return (
    closings.find(
      (c) => c.doctorId === doctorId && periodsOverlap(c.periodFrom, c.periodTo, periodFrom, periodTo)
    ) ?? null
  );
}

export type ClosingPreview = {
  doctorId: string;
  periodFrom: string;
  periodTo: string;
  encounterCount: number;
  producedCents: number;
  receivedCents: number;
  pendingCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  existing: ClinicClosing | null;
  warnings: string[];
  encounters: {
    id: string;
    patientName: string | null;
    feeCents: number;
    receivedCents: number;
    paymentStatus: string;
    attendedAt: string;
  }[];
};

export async function previewClosing(input: {
  clinicId: string;
  doctorId: string;
  periodFrom: string;
  periodTo: string;
}): Promise<ClosingPreview> {
  const from = input.periodFrom.slice(0, 10);
  const to = input.periodTo.slice(0, 10);
  if (!from || !to || from > to) throw new Error("Informe o período (de / até).");
  if (!input.doctorId) throw new Error("Informe o médico.");
  const encounters = (await listEncounters(input.clinicId, from, `${to}T23:59:59.999Z`)).filter((e) => e.doctorId === input.doctorId);
  const existingList = await listClosings(input.clinicId);
  const existing = findOverlappingClosing(existingList, input.doctorId, from, to);
  const taken = new Set(existingList.flatMap((c) => c.encounterIds));
  const fresh = existing ? [] : encounters.filter((e) => !taken.has(e.id));
  const warnings: string[] = [];
  if (existing) warnings.push(`Já existe um fechamento para este médico e período (${existing.code}).`);
  if (!existing && encounters.length === 0) warnings.push("Não há produção neste período para este médico.");
  if (!existing && encounters.length > 0 && fresh.length === 0) {
    warnings.push("Essa produção já está em outro fechamento.");
  }
  const unpaid = fresh.filter((e) => e.paymentStatus === "pending" || e.paymentStatus === "partial");
  if (unpaid.length) warnings.push(`${unpaid.length} atendimento(s) com pagamento pendente ou parcial.`);
  const zeroFee = fresh.filter((e) => e.feeCents <= 0);
  if (zeroFee.length) warnings.push(`${zeroFee.length} atendimento(s) sem valor configurado.`);
  const rule = await getFeeRule(input.clinicId, input.doctorId);
  if (!rule) warnings.push("Nenhuma regra de honorário ativa para este médico.");
  if (rule && rule.feeCents === 0) {
    warnings.push("A regra deste médico está em R$ 0. Confirme se é retorno ou cortesia.");
  }
  if (fresh.some((e) => !e.doctorId)) warnings.push("Há atendimentos sem médico identificado.");
  if (fresh.some((e) => e.clinicId !== input.clinicId)) {
    warnings.push("Há atendimentos que não pertencem a esta clínica.");
  }
  return {
    doctorId: input.doctorId,
    periodFrom: from,
    periodTo: to,
    encounterCount: fresh.length,
    producedCents: fresh.reduce((s, e) => s + e.feeCents, 0),
    receivedCents: fresh.reduce((s, e) => s + e.receivedCents, 0),
    pendingCents: fresh.reduce((s, e) => s + Math.max(0, e.feeCents - e.receivedCents), 0),
    clinicShareCents: fresh.reduce((s, e) => s + e.clinicShareCents, 0),
    doctorShareCents: fresh.reduce((s, e) => s + e.doctorShareCents, 0),
    existing,
    warnings,
    encounters: fresh.map((e) => ({
      id: e.id,
      patientName: e.patientName,
      feeCents: e.feeCents,
      receivedCents: e.receivedCents,
      paymentStatus: e.paymentStatus,
      attendedAt: e.attendedAt,
    })),
  };
}

export async function createClosing(input: {
  clinicId: string;
  doctorId: string;
  periodFrom: string;
  periodTo: string;
  createdBy: string;
}): Promise<ClinicClosing> {
  const from = input.periodFrom.slice(0, 10);
  const to = input.periodTo.slice(0, 10);
  if (!from || !to || from > to) throw new Error("Informe o período (de / até).");
  const existingList = await listClosings(input.clinicId);
  const overlap = findOverlappingClosing(existingList, input.doctorId, from, to);
  if (overlap) {
    throw new Error(`Já existe um fechamento para este médico e período (${overlap.code}).`);
  }
  const encounters = (await listEncounters(input.clinicId, from, `${to}T23:59:59.999Z`)).filter((e) => e.doctorId === input.doctorId);
  if (encounters.length === 0) throw new Error("Não há produção neste período para este médico.");
  const taken = new Set(existingList.flatMap((c) => c.encounterIds));
  const fresh = encounters.filter((e) => !taken.has(e.id));
  if (fresh.length === 0) throw new Error("Essa produção já está em outro fechamento.");
  const year = Number(to.slice(0, 4)) || new Date().getFullYear();
  const now = new Date().toISOString();
  const row: ClinicClosing = {
    id: uuid(),
    clinicId: input.clinicId,
    doctorId: input.doctorId,
    code: await nextCode(year),
    periodFrom: from,
    periodTo: to,
    encounterIds: fresh.map((e) => e.id),
    producedCents: fresh.reduce((s, e) => s + e.feeCents, 0),
    receivedCents: fresh.reduce((s, e) => s + e.receivedCents, 0),
    clinicShareCents: fresh.reduce((s, e) => s + e.clinicShareCents, 0),
    doctorShareCents: fresh.reduce((s, e) => s + e.doctorShareCents, 0),
    status: "closed",
    createdBy: input.createdBy,
    paidAt: null,
    paidBy: null,
    createdAt: now,
    updatedAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_closings").insert({
      id: row.id,
      clinic_id: row.clinicId,
      doctor_id: row.doctorId,
      code: row.code,
      period_from: row.periodFrom,
      period_to: row.periodTo,
      encounter_ids: row.encounterIds,
      produced_cents: row.producedCents,
      received_cents: row.receivedCents,
      clinic_share_cents: row.clinicShareCents,
      doctor_share_cents: row.doctorShareCents,
      status: row.status,
      created_by: row.createdBy,
      created_at: now,
      updated_at: now,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await logClosingFinanceEvent({
        clinicId: input.clinicId,
        kind: "closing",
        entity: "clinic_closing",
        entityId: row.id,
        afterCents: row.doctorShareCents,
        reason: row.code,
        actorId: input.createdBy,
      });
      return row;
    }
  }
  const local = await readLocal();
  local.closings.unshift(row);
  await writeLocal(local);
  await logClosingFinanceEvent({
    clinicId: input.clinicId,
    kind: "closing",
    entity: "clinic_closing",
    entityId: row.id,
    afterCents: row.doctorShareCents,
    reason: row.code,
    actorId: input.createdBy,
  });
  return row;
}

export async function markClosingPaid(closingId: string, paidBy: string, clinicId?: string): Promise<ClinicClosing> {
  const row = await getClosing(closingId);
  if (!row || (clinicId && row.clinicId !== clinicId)) throw new Error("Fechamento não encontrado.");
  if (row.status === "paid") return row;
  const now = new Date().toISOString();
  const next: ClinicClosing = { ...row, status: "paid", paidAt: now, paidBy, updatedAt: now };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_closings").update({ status: "paid", paid_at: now, paid_by: paidBy, updated_at: now }).eq("id", closingId);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await logClosingFinanceEvent({
        clinicId: row.clinicId,
        kind: "payout",
        entity: "clinic_closing",
        entityId: row.id,
        afterCents: row.doctorShareCents,
        reason: row.code,
        actorId: paidBy,
      });
      return next;
    }
  }
  const local = await readLocal();
  const idx = local.closings.findIndex((c) => c.id === closingId);
  if (idx >= 0) local.closings[idx] = next;
  await writeLocal(local);
  await logClosingFinanceEvent({
    clinicId: row.clinicId,
    kind: "payout",
    entity: "clinic_closing",
    entityId: row.id,
    afterCents: row.doctorShareCents,
    reason: row.code,
    actorId: paidBy,
  });
  return next;
}

export async function addClosingAdjustment(input: {
  closingId: string;
  clinicId: string;
  kind: AdjustmentKind;
  amountCents: number;
  reason: string;
  createdByKind?: string;
  createdById?: string;
  createdByEmail?: string;
}): Promise<ClinicClosingAdjustment> {
  const closing = await getClosing(input.closingId);
  if (!closing || closing.clinicId !== input.clinicId) throw new Error("Fechamento não encontrado.");
  if (closing.status !== "paid") throw new Error("Ajuste auditado só depois do repasse pago.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Informe o motivo do ajuste (mínimo 5 caracteres).");
  const amount = Math.round(Math.abs(input.amountCents));
  if (amount <= 0) throw new Error("Valor do ajuste inválido.");
  const row: ClinicClosingAdjustment = {
    id: uuid(),
    closingId: input.closingId,
    clinicId: input.clinicId,
    kind: input.kind,
    amountCents: amount,
    reason,
    createdByKind: input.createdByKind ?? null,
    createdById: input.createdById ?? null,
    createdByEmail: input.createdByEmail ?? null,
    createdAt: new Date().toISOString(),
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_closing_adjustments").insert({
      id: row.id,
      closing_id: row.closingId,
      clinic_id: row.clinicId,
      kind: row.kind,
      amount_cents: row.amountCents,
      reason: row.reason,
      created_by_kind: row.createdByKind,
      created_by_id: row.createdById,
      created_by_email: row.createdByEmail,
      created_at: row.createdAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await logClosingFinanceEvent({
        clinicId: input.clinicId,
        kind: "adjustment",
        entity: "clinic_closing_adjustment",
        entityId: row.id,
        afterCents: row.kind === "debit" ? -row.amountCents : row.amountCents,
        reason: row.reason,
        actorKind: row.createdByKind,
        actorId: row.createdById,
        actorEmail: row.createdByEmail,
      });
      return row;
    }
  }
  const local = await readLocal();
  local.adjustments.unshift(row);
  await writeLocal(local);
  await logClosingFinanceEvent({
    clinicId: input.clinicId,
    kind: "adjustment",
    entity: "clinic_closing_adjustment",
    entityId: row.id,
    afterCents: row.kind === "debit" ? -row.amountCents : row.amountCents,
    reason: row.reason,
    actorKind: row.createdByKind,
    actorId: row.createdById,
    actorEmail: row.createdByEmail,
  });
  return row;
}
