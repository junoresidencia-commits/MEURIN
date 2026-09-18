import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { writeFinanceEvent, listPayments, listEncounters, listEncountersByPatientKey } from "./clinic-finance-store";
import { productionSummary } from "./clinic-finance-store";
import { CLINIC_CASH_BUCKET, saveFile, type StorageKind } from "./doc-storage";
import { nfseConfigured, issueNfse } from "./nfse-provider";
import { buildReceiptPdf } from "./clinic-receipt-pdf";
import type {
  ClinicCashOrigin,
  ClinicCashSession,
  ClinicExpense,
  ClinicExpenseCategory,
  ClinicExpenseMethod,
  ClinicFiscalDoc,
  ClinicFiscalKind,
  ClinicFiscalStatus,
  ClinicPayment,
  ClinicPaymentMethod,
} from "./platform-types";
import {
  CLINIC_CASH_ORIGINS,
  CLINIC_EXPENSE_CATEGORIES,
  CLINIC_EXPENSE_METHODS,
} from "./platform-types";
import {
  CASH_ORIGIN_LABEL,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_METHOD_LABEL,
  NFSE_STATUS_LABEL,
} from "./clinic-cash-labels";

export { CASH_ORIGIN_LABEL, EXPENSE_CATEGORY_LABEL, EXPENSE_METHOD_LABEL, NFSE_STATUS_LABEL };

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-cash.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

type LocalDb = {
  expenses: ClinicExpense[];
  sessions: ClinicCashSession[];
  fiscal: ClinicFiscalDoc[];
};

async function readLocal(): Promise<LocalDb> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<LocalDb>;
    return {
      expenses: raw.expenses || [],
      sessions: raw.sessions || [],
      fiscal: raw.fiscal || [],
    };
  } catch {
    return { expenses: [], sessions: [], fiscal: [] };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[clinic-cash] persistência local indisponível", err);
  }
}

function mapExpense(r: Record<string, unknown>): ClinicExpense {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    occurredAt: String(r.occurred_at ?? r.occurredAt),
    amountCents: Number(r.amount_cents ?? r.amountCents ?? 0),
    category: String(r.category) as ClinicExpenseCategory,
    description: String(r.description || ""),
    method: String(r.method) as ClinicExpenseMethod,
    origin: String(r.origin) as ClinicCashOrigin,
    responsibleName: String(r.responsible_name ?? r.responsibleName ?? ""),
    locationLabel: (r.location_label as string) ?? (r.locationLabel as string) ?? null,
    notes: (r.notes as string) ?? null,
    attachmentPath: (r.attachment_path as string) ?? (r.attachmentPath as string) ?? null,
    attachmentStorage: ((r.attachment_storage as string) ?? (r.attachmentStorage as string) ?? null) as StorageKind | null,
    attachmentName: (r.attachment_name as string) ?? (r.attachmentName as string) ?? null,
    attachmentMime: (r.attachment_mime as string) ?? (r.attachmentMime as string) ?? null,
    correctedFromId: (r.corrected_from_id as string) ?? (r.correctedFromId as string) ?? null,
    voidedAt: (r.voided_at as string) ?? (r.voidedAt as string) ?? null,
    voidReason: (r.void_reason as string) ?? (r.voidReason as string) ?? null,
    voidedByKind: (r.voided_by_kind as string) ?? (r.voidedByKind as string) ?? null,
    voidedById: (r.voided_by_id as string) ?? (r.voidedById as string) ?? null,
    recordedByKind: (r.recorded_by_kind as string) ?? (r.recordedByKind as string) ?? null,
    recordedById: (r.recorded_by_id as string) ?? (r.recordedById as string) ?? null,
    recordedByEmail: (r.recorded_by_email as string) ?? (r.recordedByEmail as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}

function expenseInsert(row: ClinicExpense) {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    occurred_at: row.occurredAt,
    amount_cents: row.amountCents,
    category: row.category,
    description: row.description,
    method: row.method,
    origin: row.origin,
    responsible_name: row.responsibleName,
    location_label: row.locationLabel,
    notes: row.notes,
    attachment_path: row.attachmentPath,
    attachment_storage: row.attachmentStorage,
    attachment_name: row.attachmentName,
    attachment_mime: row.attachmentMime,
    corrected_from_id: row.correctedFromId,
    voided_at: row.voidedAt,
    void_reason: row.voidReason,
    voided_by_kind: row.voidedByKind,
    voided_by_id: row.voidedById,
    recorded_by_kind: row.recordedByKind,
    recorded_by_id: row.recordedById,
    recorded_by_email: row.recordedByEmail,
    created_at: row.createdAt,
  };
}

function mapSession(r: Record<string, unknown>): ClinicCashSession {
  const byMethod = (r.by_method ?? r.byMethod ?? {}) as Record<string, number>;
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    day: String(r.day).slice(0, 10),
    openingCents: Number(r.opening_cents ?? r.openingCents ?? 0),
    inCents: Number(r.in_cents ?? r.inCents ?? 0),
    outCents: Number(r.out_cents ?? r.outCents ?? 0),
    expectedCents: Number(r.expected_cents ?? r.expectedCents ?? 0),
    countedCents: Number(r.counted_cents ?? r.countedCents ?? 0),
    differenceCents: Number(r.difference_cents ?? r.differenceCents ?? 0),
    justification: (r.justification as string) ?? null,
    byMethod,
    closedByKind: (r.closed_by_kind as string) ?? (r.closedByKind as string) ?? null,
    closedById: (r.closed_by_id as string) ?? (r.closedById as string) ?? null,
    closedByName: (r.closed_by_name as string) ?? (r.closedByName as string) ?? null,
    closedByEmail: (r.closed_by_email as string) ?? (r.closedByEmail as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}

function mapFiscal(r: Record<string, unknown>): ClinicFiscalDoc {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    encounterId: (r.encounter_id as string) ?? (r.encounterId as string) ?? null,
    patientKey: String(r.patient_key ?? r.patientKey),
    kind: String(r.kind) as ClinicFiscalKind,
    status: String(r.status) as ClinicFiscalStatus,
    amountCents: Number(r.amount_cents ?? r.amountCents ?? 0),
    serviceLabel: String(r.service_label ?? r.serviceLabel ?? "Consulta"),
    paymentMethod: (r.payment_method as string) ?? (r.paymentMethod as string) ?? null,
    patientName: String(r.patient_name ?? r.patientName ?? ""),
    patientCpf: (r.patient_cpf as string) ?? (r.patientCpf as string) ?? null,
    patientEmail: (r.patient_email as string) ?? (r.patientEmail as string) ?? null,
    patientPhone: (r.patient_phone as string) ?? (r.patientPhone as string) ?? null,
    patientAddress: (r.patient_address as string) ?? (r.patientAddress as string) ?? null,
    doctorId: (r.doctor_id as string) ?? (r.doctorId as string) ?? null,
    doctorName: (r.doctor_name as string) ?? (r.doctorName as string) ?? null,
    doctorCrm: (r.doctor_crm as string) ?? (r.doctorCrm as string) ?? null,
    clinicName: (r.clinic_name as string) ?? (r.clinicName as string) ?? null,
    number: (r.number as string) ?? null,
    issuedAt: (r.issued_at as string) ?? (r.issuedAt as string) ?? null,
    providerRef: (r.provider_ref as string) ?? (r.providerRef as string) ?? null,
    errorMessage: (r.error_message as string) ?? (r.errorMessage as string) ?? null,
    pdfPath: (r.pdf_path as string) ?? (r.pdfPath as string) ?? null,
    pdfStorage: ((r.pdf_storage as string) ?? (r.pdfStorage as string) ?? null) as StorageKind | null,
    xmlPath: (r.xml_path as string) ?? (r.xmlPath as string) ?? null,
    xmlStorage: ((r.xml_storage as string) ?? (r.xmlStorage as string) ?? null) as StorageKind | null,
    xmlName: (r.xml_name as string) ?? (r.xmlName as string) ?? null,
    requestedByKind: (r.requested_by_kind as string) ?? (r.requestedByKind as string) ?? null,
    requestedById: (r.requested_by_id as string) ?? (r.requestedById as string) ?? null,
    requestedByEmail: (r.requested_by_email as string) ?? (r.requestedByEmail as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}

function fiscalInsert(row: ClinicFiscalDoc) {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    encounter_id: row.encounterId,
    patient_key: row.patientKey,
    kind: row.kind,
    status: row.status,
    amount_cents: row.amountCents,
    service_label: row.serviceLabel,
    payment_method: row.paymentMethod,
    patient_name: row.patientName,
    patient_cpf: row.patientCpf,
    patient_email: row.patientEmail,
    patient_phone: row.patientPhone,
    patient_address: row.patientAddress,
    doctor_id: row.doctorId,
    doctor_name: row.doctorName,
    doctor_crm: row.doctorCrm,
    clinic_name: row.clinicName,
    number: row.number,
    issued_at: row.issuedAt,
    provider_ref: row.providerRef,
    error_message: row.errorMessage,
    pdf_path: row.pdfPath,
    pdf_storage: row.pdfStorage,
    xml_path: row.xmlPath,
    xml_storage: row.xmlStorage,
    xml_name: row.xmlName,
    requested_by_kind: row.requestedByKind,
    requested_by_id: row.requestedById,
    requested_by_email: row.requestedByEmail,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

async function logEvent(input: Parameters<typeof writeFinanceEvent>[0]) {
  try {
    await writeFinanceEvent(input);
  } catch (err) {
    console.error("[clinic-cash] histórico indisponível", err);
  }
}

export async function listExpenses(clinicId: string, from?: string, to?: string): Promise<ClinicExpense[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    let q = sb.from("clinic_expenses").select("*").eq("clinic_id", clinicId).order("occurred_at", { ascending: false });
    if (from) q = q.gte("occurred_at", from.length === 10 ? `${from}T00:00:00.000Z` : from);
    if (to) q = q.lte("occurred_at", to.length === 10 ? `${to}T23:59:59.999Z` : to);
    const { data, error } = await q;
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapExpense(r as Record<string, unknown>));
    }
  }
  let rows = (await readLocal()).expenses.filter((e) => e.clinicId === clinicId);
  if (from) {
    const start = from.length === 10 ? `${from}T00:00:00.000Z` : from;
    rows = rows.filter((e) => e.occurredAt >= start);
  }
  if (to) {
    const end = to.length === 10 ? `${to}T23:59:59.999Z` : to;
    rows = rows.filter((e) => e.occurredAt <= end);
  }
  return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function getExpense(id: string): Promise<ClinicExpense | null> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_expenses").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapExpense(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).expenses.find((e) => e.id === id) ?? null;
}

export type ExpenseAttachment = { name: string; type?: string; buffer: Buffer };

export async function createExpense(input: {
  clinicId: string;
  occurredAt?: string;
  amountCents: number;
  category: ClinicExpenseCategory;
  description: string;
  method: ClinicExpenseMethod;
  origin: ClinicCashOrigin;
  responsibleName: string;
  locationLabel?: string | null;
  notes?: string | null;
  attachment?: ExpenseAttachment | null;
  correctedFromId?: string | null;
  recordedByKind?: string | null;
  recordedById?: string | null;
  recordedByEmail?: string | null;
}): Promise<ClinicExpense> {
  if (!CLINIC_EXPENSE_CATEGORIES.includes(input.category)) throw new Error("Categoria inválida.");
  if (!CLINIC_EXPENSE_METHODS.includes(input.method)) throw new Error("Forma de pagamento inválida.");
  if (!CLINIC_CASH_ORIGINS.includes(input.origin)) throw new Error("Origem inválida.");
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe o valor da despesa.");
  const description = input.description.trim();
  if (!description) throw new Error("Descreva a despesa.");
  const responsibleName = input.responsibleName.trim();
  if (!responsibleName) throw new Error("Informe quem retirou ou lançou.");
  let attachmentPath: string | null = null;
  let attachmentStorage: StorageKind | null = null;
  let attachmentName: string | null = null;
  let attachmentMime: string | null = null;
  if (input.attachment?.buffer?.length) {
    const saved = await saveFile(CLINIC_CASH_BUCKET, `expenses/${input.clinicId}`, {
      name: input.attachment.name || "comprovante",
      type: input.attachment.type,
      buffer: input.attachment.buffer,
    });
    attachmentPath = saved.path;
    attachmentStorage = saved.storage;
    attachmentName = input.attachment.name || "comprovante";
    attachmentMime = input.attachment.type || null;
  }
  const now = new Date().toISOString();
  const row: ClinicExpense = {
    id: uuid(),
    clinicId: input.clinicId,
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
    amountCents: amount,
    category: input.category,
    description,
    method: input.method,
    origin: input.origin,
    responsibleName,
    locationLabel: input.locationLabel?.trim() || null,
    notes: input.notes?.trim() || null,
    attachmentPath,
    attachmentStorage,
    attachmentName,
    attachmentMime,
    correctedFromId: input.correctedFromId ?? null,
    voidedAt: null,
    voidReason: null,
    voidedByKind: null,
    voidedById: null,
    recordedByKind: input.recordedByKind ?? null,
    recordedById: input.recordedById ?? null,
    recordedByEmail: input.recordedByEmail ?? null,
    createdAt: now,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_expenses").insert(expenseInsert(row));
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await logEvent({
        clinicId: input.clinicId,
        kind: input.correctedFromId ? "expense_correction" : "expense",
        entity: "clinic_expense",
        entityId: row.id,
        beforeCents: null,
        afterCents: row.amountCents,
        reason: row.description,
        actorKind: row.recordedByKind,
        actorId: row.recordedById,
        actorEmail: row.recordedByEmail,
      });
      return row;
    }
  }
  const local = await readLocal();
  local.expenses.unshift(row);
  await writeLocal(local);
  await logEvent({
    clinicId: input.clinicId,
    kind: input.correctedFromId ? "expense_correction" : "expense",
    entity: "clinic_expense",
    entityId: row.id,
    beforeCents: null,
    afterCents: row.amountCents,
    reason: row.description,
    actorKind: row.recordedByKind,
    actorId: row.recordedById,
    actorEmail: row.recordedByEmail,
  });
  return row;
}

async function saveExpense(row: ClinicExpense) {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from("clinic_expenses")
      .update({
        voided_at: row.voidedAt,
        void_reason: row.voidReason,
        voided_by_kind: row.voidedByKind,
        voided_by_id: row.voidedById,
      })
      .eq("id", row.id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.expenses.findIndex((e) => e.id === row.id);
  if (idx >= 0) local.expenses[idx] = row;
  await writeLocal(local);
}

/** Não apaga. Anula o lançamento e grava um novo com o valor corrigido. */
export async function correctExpense(input: {
  clinicId: string;
  expenseId: string;
  amountCents: number;
  reason: string;
  description?: string;
  category?: ClinicExpenseCategory;
  method?: ClinicExpenseMethod;
  origin?: ClinicCashOrigin;
  actorKind?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
}): Promise<{ previous: ClinicExpense; next: ClinicExpense }> {
  const previous = await getExpense(input.expenseId);
  if (!previous || previous.clinicId !== input.clinicId) throw new Error("Despesa não encontrada.");
  if (previous.voidedAt) throw new Error("Este lançamento já foi corrigido. O histórico permanece.");
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("Informe o motivo da correção (pelo menos 8 caracteres).");
  const now = new Date().toISOString();
  const voided: ClinicExpense = {
    ...previous,
    voidedAt: now,
    voidReason: reason,
    voidedByKind: input.actorKind ?? null,
    voidedById: input.actorId ?? null,
  };
  await saveExpense(voided);
  const next = await createExpense({
    clinicId: input.clinicId,
    occurredAt: previous.occurredAt,
    amountCents: input.amountCents,
    category: input.category || previous.category,
    description: input.description?.trim() || previous.description,
    method: input.method || previous.method,
    origin: input.origin || previous.origin,
    responsibleName: previous.responsibleName,
    locationLabel: previous.locationLabel,
    notes: previous.notes,
    correctedFromId: previous.id,
    recordedByKind: input.actorKind,
    recordedById: input.actorId,
    recordedByEmail: input.actorEmail,
  });
  await logEvent({
    clinicId: input.clinicId,
    kind: "expense_correction",
    entity: "clinic_expense",
    entityId: next.id,
    beforeCents: previous.amountCents,
    afterCents: next.amountCents,
    reason,
    actorKind: input.actorKind ?? null,
    actorId: input.actorId ?? null,
    actorEmail: input.actorEmail ?? null,
  });
  return { previous: voided, next };
}

function paymentBucket(method: ClinicPaymentMethod): "dinheiro" | "pix" | "cartao" | "outras" {
  if (method === "cash") return "dinheiro";
  if (method === "pix") return "pix";
  if (method === "card") return "cartao";
  return "outras";
}
function expenseBucket(method: ClinicExpenseMethod): "dinheiro" | "pix" | "cartao" | "outras" {
  if (method === "dinheiro") return "dinheiro";
  if (method === "pix") return "pix";
  if (method === "debito" || method === "credito") return "cartao";
  return "outras";
}

function inRange(iso: string, from?: string, to?: string) {
  const day = iso.slice(0, 10);
  if (from && day < from.slice(0, 10)) return false;
  if (to && day > to.slice(0, 10)) return false;
  return true;
}

export type CashFlowFilters = {
  from: string;
  to: string;
  doctorId?: string;
  category?: ClinicExpenseCategory;
  method?: string;
};

export async function cashFlow(clinicId: string, filters: CashFlowFilters) {
  const { from, to } = filters;
  const [payments, expenses, encounters] = await Promise.all([
    listPayments(clinicId),
    listExpenses(clinicId),
    listEncounters(clinicId),
  ]);
  const encounterById = new Map(encounters.map((e) => [e.id, e]));
  const liveExpenses = expenses.filter((e) => !e.voidedAt);
  const incomeOk = (p: ClinicPayment) => {
    if (p.method === "courtesy" || p.amountCents <= 0) return false;
    if (filters.doctorId) {
      const enc = encounterById.get(p.encounterId);
      if (!enc || enc.doctorId !== filters.doctorId) return false;
    }
    if (filters.method) {
      const bucket = paymentBucket(p.method);
      if (filters.method === "dinheiro" && bucket !== "dinheiro") return false;
      if (filters.method === "pix" && bucket !== "pix") return false;
      if (filters.method === "cartao" && bucket !== "cartao") return false;
      if (filters.method === "outras" && bucket !== "outras") return false;
      if (["cash", "pix", "card", "other"].includes(filters.method) && p.method !== filters.method) return false;
    }
    return true;
  };
  const expenseOk = (e: ClinicExpense) => {
    if (filters.category && e.category !== filters.category) return false;
    if (filters.method) {
      const bucket = expenseBucket(e.method);
      if (filters.method === "dinheiro" && bucket !== "dinheiro") return false;
      if (filters.method === "pix" && bucket !== "pix") return false;
      if (filters.method === "cartao" && bucket !== "cartao") return false;
      if (filters.method === "outras" && bucket !== "outras") return false;
      if (CLINIC_EXPENSE_METHODS.includes(filters.method as ClinicExpenseMethod) && e.method !== filters.method) {
        return false;
      }
    }
    return true;
  };

  const openingIn = payments.filter((p) => incomeOk(p) && p.createdAt.slice(0, 10) < from).reduce((s, p) => s + p.amountCents, 0);
  const openingOut = liveExpenses.filter((e) => expenseOk(e) && e.occurredAt.slice(0, 10) < from).reduce((s, e) => s + e.amountCents, 0);
  const openingCents = openingIn - openingOut;

  const periodPayments = payments.filter((p) => incomeOk(p) && inRange(p.createdAt, from, to));
  const periodExpenses = liveExpenses.filter((e) => expenseOk(e) && inRange(e.occurredAt, from, to));
  const inCents = periodPayments.reduce((s, p) => s + p.amountCents, 0);
  const outCents = periodExpenses.reduce((s, e) => s + e.amountCents, 0);
  const closingCents = openingCents + inCents - outCents;

  const byMethod = {
    dinheiro: { inCents: 0, outCents: 0 },
    pix: { inCents: 0, outCents: 0 },
    cartao: { inCents: 0, outCents: 0 },
    outras: { inCents: 0, outCents: 0 },
  };
  for (const p of periodPayments) byMethod[paymentBucket(p.method)].inCents += p.amountCents;
  for (const e of periodExpenses) byMethod[expenseBucket(e.method)].outCents += e.amountCents;

  return {
    from,
    to,
    openingCents,
    inCents,
    outCents,
    closingCents,
    byMethod,
    payments: periodPayments,
    expenses: periodExpenses,
  };
}

export async function listCashSessions(clinicId: string): Promise<ClinicCashSession[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("clinic_cash_sessions")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("day", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapSession(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).sessions.filter((s) => s.clinicId === clinicId).sort((a, b) => b.day.localeCompare(a.day));
}

export async function getCashSessionByDay(clinicId: string, day: string): Promise<ClinicCashSession | null> {
  const d = day.slice(0, 10);
  return (await listCashSessions(clinicId)).find((s) => s.day === d) ?? null;
}

export async function closeCashDay(input: {
  clinicId: string;
  day?: string;
  countedCents: number;
  justification?: string;
  closedByKind?: string | null;
  closedById?: string | null;
  closedByName?: string | null;
  closedByEmail?: string | null;
}): Promise<ClinicCashSession> {
  const day = (input.day || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const existing = await getCashSessionByDay(input.clinicId, day);
  if (existing) throw new Error("Este dia já foi fechado. O histórico de fechamento não pode ser apagado.");
  const counted = Math.round(input.countedCents);
  if (!Number.isFinite(counted) || counted < 0) throw new Error("Informe o valor contado no caixa.");

  const sessions = await listCashSessions(input.clinicId);
  const previous = sessions.filter((s) => s.day < day).sort((a, b) => b.day.localeCompare(a.day))[0];
  const openingCents = previous?.countedCents ?? 0;

  const [payments, expenses] = await Promise.all([listPayments(input.clinicId), listExpenses(input.clinicId, day, day)]);
  const dayPayments = payments.filter((p) => p.createdAt.slice(0, 10) === day && p.method !== "courtesy" && p.amountCents > 0);
  const liveExp = expenses.filter((e) => !e.voidedAt && e.occurredAt.slice(0, 10) === day);
  const cashIn = dayPayments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amountCents, 0);
  const cashOut = liveExp
    .filter((e) => e.origin === "caixa_fisico" || e.method === "dinheiro")
    .reduce((s, e) => s + e.amountCents, 0);
  const expectedCents = openingCents + cashIn - cashOut;
  const differenceCents = counted - expectedCents;
  if (differenceCents !== 0 && String(input.justification || "").trim().length < 8) {
    throw new Error("Há diferença entre o sistema e o caixa contado. Justifique para fechar.");
  }

  const byMethod: Record<string, number> = { dinheiro: 0, pix: 0, cartao: 0, outras: 0 };
  for (const p of dayPayments) byMethod[paymentBucket(p.method)] += p.amountCents;

  const now = new Date().toISOString();
  const row: ClinicCashSession = {
    id: uuid(),
    clinicId: input.clinicId,
    day,
    openingCents,
    inCents: cashIn,
    outCents: cashOut,
    expectedCents,
    countedCents: counted,
    differenceCents,
    justification: differenceCents === 0 ? input.justification?.trim() || null : String(input.justification).trim(),
    byMethod,
    closedByKind: input.closedByKind ?? null,
    closedById: input.closedById ?? null,
    closedByName: input.closedByName ?? null,
    closedByEmail: input.closedByEmail ?? null,
    createdAt: now,
  };

  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_cash_sessions").insert({
      id: row.id,
      clinic_id: row.clinicId,
      day: row.day,
      opening_cents: row.openingCents,
      in_cents: row.inCents,
      out_cents: row.outCents,
      expected_cents: row.expectedCents,
      counted_cents: row.countedCents,
      difference_cents: row.differenceCents,
      justification: row.justification,
      by_method: row.byMethod,
      closed_by_kind: row.closedByKind,
      closed_by_id: row.closedById,
      closed_by_name: row.closedByName,
      closed_by_email: row.closedByEmail,
      created_at: row.createdAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) {
      await logEvent({
        clinicId: input.clinicId,
        kind: "cash_close",
        entity: "clinic_cash_session",
        entityId: row.id,
        beforeCents: expectedCents,
        afterCents: counted,
        reason: row.justification,
        actorKind: row.closedByKind,
        actorId: row.closedById,
        actorEmail: row.closedByEmail,
      });
      return row;
    }
  }
  const local = await readLocal();
  local.sessions.unshift(row);
  await writeLocal(local);
  await logEvent({
    clinicId: input.clinicId,
    kind: "cash_close",
    entity: "clinic_cash_session",
    entityId: row.id,
    beforeCents: expectedCents,
    afterCents: counted,
    reason: row.justification,
    actorKind: row.closedByKind,
    actorId: row.closedById,
    actorEmail: row.closedByEmail,
  });
  return row;
}

export async function listFiscalDocs(clinicId: string, kind?: ClinicFiscalKind): Promise<ClinicFiscalDoc[]> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    let q = sb.from("clinic_fiscal_docs").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapFiscal(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).fiscal
    .filter((d) => d.clinicId === clinicId && (!kind || d.kind === kind))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listFiscalForPatient(patientKeys: string[]): Promise<ClinicFiscalDoc[]> {
  const keys = new Set(patientKeys.map((k) => k.toLowerCase().trim()).filter(Boolean));
  if (!keys.size) return [];
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb
      .from("clinic_fiscal_docs")
      .select("*")
      .in("patient_key", Array.from(keys))
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => mapFiscal(r as Record<string, unknown>));
    }
  }
  return (await readLocal()).fiscal
    .filter((d) => keys.has(d.patientKey.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFiscalDoc(id: string): Promise<ClinicFiscalDoc | null> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data, error } = await sb.from("clinic_fiscal_docs").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else {
      return data ? mapFiscal(data as Record<string, unknown>) : null;
    }
  }
  return (await readLocal()).fiscal.find((d) => d.id === id) ?? null;
}

async function insertFiscal(row: ClinicFiscalDoc): Promise<ClinicFiscalDoc> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_fiscal_docs").insert(fiscalInsert(row));
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  local.fiscal.unshift(row);
  await writeLocal(local);
  return row;
}

async function saveFiscal(row: ClinicFiscalDoc): Promise<void> {
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = await sb.from("clinic_fiscal_docs").update(fiscalInsert(row)).eq("id", row.id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.fiscal.findIndex((d) => d.id === row.id);
  if (idx >= 0) local.fiscal[idx] = row;
  else local.fiscal.unshift(row);
  await writeLocal(local);
}

export type FiscalActor = {
  kind?: string | null;
  id?: string | null;
  email?: string | null;
};

export async function createReceiptDoc(input: {
  clinicId: string;
  clinicName: string;
  clinicLegalName?: string | null;
  clinicCnpj?: string | null;
  clinicCity?: string | null;
  encounterId?: string | null;
  patientKey: string;
  amountCents: number;
  serviceLabel?: string;
  paymentMethod?: string | null;
  patientName: string;
  patientCpf?: string | null;
  patientEmail?: string | null;
  patientPhone?: string | null;
  patientAddress?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  actor?: FiscalActor;
}): Promise<ClinicFiscalDoc> {
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe o valor do recibo.");
  const now = new Date().toISOString();
  const number = `REC-${now.slice(0, 10).replace(/-/g, "")}-${uuid().slice(0, 6).toUpperCase()}`;
  const pdfBytes = await buildReceiptPdf({
    clinicName: input.clinicName,
    clinicLegalName: input.clinicLegalName,
    clinicCnpj: input.clinicCnpj,
    clinicCity: input.clinicCity,
    number,
    issuedAt: now,
    amountCents: amount,
    serviceLabel: input.serviceLabel || "Consulta",
    paymentMethod: input.paymentMethod,
    patientName: input.patientName,
    patientCpf: input.patientCpf,
    doctorName: input.doctorName,
    doctorCrm: input.doctorCrm,
  });
  const saved = await saveFile(CLINIC_CASH_BUCKET, `recibos/${input.clinicId}`, {
    name: `recibo-${number}.pdf`,
    type: "application/pdf",
    buffer: Buffer.from(pdfBytes),
  });
  const row: ClinicFiscalDoc = {
    id: uuid(),
    clinicId: input.clinicId,
    encounterId: input.encounterId ?? null,
    patientKey: input.patientKey.toLowerCase().trim(),
    kind: "recibo",
    status: "issued",
    amountCents: amount,
    serviceLabel: input.serviceLabel || "Consulta",
    paymentMethod: input.paymentMethod ?? null,
    patientName: input.patientName,
    patientCpf: input.patientCpf ?? null,
    patientEmail: input.patientEmail ?? null,
    patientPhone: input.patientPhone ?? null,
    patientAddress: input.patientAddress ?? null,
    doctorId: input.doctorId ?? null,
    doctorName: input.doctorName ?? null,
    doctorCrm: input.doctorCrm ?? null,
    clinicName: input.clinicName,
    number,
    issuedAt: now,
    providerRef: null,
    errorMessage: null,
    pdfPath: saved.path,
    pdfStorage: saved.storage,
    xmlPath: null,
    xmlStorage: null,
    xmlName: null,
    requestedByKind: input.actor?.kind ?? null,
    requestedById: input.actor?.id ?? null,
    requestedByEmail: input.actor?.email ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await insertFiscal(row);
  await logEvent({
    clinicId: input.clinicId,
    kind: "receipt",
    entity: "clinic_fiscal_doc",
    entityId: row.id,
    beforeCents: null,
    afterCents: amount,
    reason: `Recibo ${number}`,
    actorKind: row.requestedByKind,
    actorId: row.requestedById,
    actorEmail: row.requestedByEmail,
  });
  return row;
}

export async function requestNfseDoc(input: {
  clinicId: string;
  clinicName: string;
  clinicCnpj?: string | null;
  encounterId?: string | null;
  patientKey: string;
  amountCents: number;
  serviceLabel?: string;
  paymentMethod?: string | null;
  patientName: string;
  patientCpf?: string | null;
  patientEmail?: string | null;
  patientPhone?: string | null;
  patientAddress?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  actor?: FiscalActor;
}): Promise<{ doc: ClinicFiscalDoc; autoIssued: boolean; queued: boolean }> {
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe o valor da nota.");
  const now = new Date().toISOString();
  const row: ClinicFiscalDoc = {
    id: uuid(),
    clinicId: input.clinicId,
    encounterId: input.encounterId ?? null,
    patientKey: input.patientKey.toLowerCase().trim(),
    kind: "nfse",
    status: nfseConfigured() ? "issuing" : "pending",
    amountCents: amount,
    serviceLabel: input.serviceLabel || "Consulta",
    paymentMethod: input.paymentMethod ?? null,
    patientName: input.patientName,
    patientCpf: input.patientCpf ?? null,
    patientEmail: input.patientEmail ?? null,
    patientPhone: input.patientPhone ?? null,
    patientAddress: input.patientAddress ?? null,
    doctorId: input.doctorId ?? null,
    doctorName: input.doctorName ?? null,
    doctorCrm: input.doctorCrm ?? null,
    clinicName: input.clinicName,
    number: null,
    issuedAt: null,
    providerRef: null,
    errorMessage: null,
    pdfPath: null,
    pdfStorage: null,
    xmlPath: null,
    xmlStorage: null,
    xmlName: null,
    requestedByKind: input.actor?.kind ?? null,
    requestedById: input.actor?.id ?? null,
    requestedByEmail: input.actor?.email ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await insertFiscal(row);
  await logEvent({
    clinicId: input.clinicId,
    kind: "nfse_request",
    entity: "clinic_fiscal_doc",
    entityId: row.id,
    beforeCents: null,
    afterCents: amount,
    reason: nfseConfigured() ? "Emissão automática" : "Fila de emissão",
    actorKind: row.requestedByKind,
    actorId: row.requestedById,
    actorEmail: row.requestedByEmail,
  });

  if (!nfseConfigured()) {
    return { doc: row, autoIssued: false, queued: true };
  }

  try {
    const issued = await issueNfse({
      clinicId: input.clinicId,
      clinicName: input.clinicName,
      clinicCnpj: input.clinicCnpj,
      amountCents: amount,
      serviceLabel: row.serviceLabel,
      patientName: row.patientName,
      patientCpf: row.patientCpf,
      patientEmail: row.patientEmail,
      patientAddress: row.patientAddress,
      doctorName: row.doctorName,
      doctorCrm: row.doctorCrm,
      issuedAt: now,
    });
    if (issued.pdf) {
      const saved = await saveFile(CLINIC_CASH_BUCKET, `nfse/${input.clinicId}`, issued.pdf);
      row.pdfPath = saved.path;
      row.pdfStorage = saved.storage;
    }
    if (issued.xml) {
      const saved = await saveFile(CLINIC_CASH_BUCKET, `nfse/${input.clinicId}`, issued.xml);
      row.xmlPath = saved.path;
      row.xmlStorage = saved.storage;
      row.xmlName = issued.xml.name;
    }
    row.status = "issued";
    row.number = issued.number;
    row.providerRef = issued.providerRef;
    row.issuedAt = now;
    row.updatedAt = new Date().toISOString();
    await saveFiscal(row);
    await logEvent({
      clinicId: input.clinicId,
      kind: "nfse_issue",
      entity: "clinic_fiscal_doc",
      entityId: row.id,
      beforeCents: null,
      afterCents: amount,
      reason: issued.number,
      actorKind: row.requestedByKind,
      actorId: row.requestedById,
      actorEmail: row.requestedByEmail,
    });
    return { doc: row, autoIssued: true, queued: false };
  } catch (err) {
    row.status = "error";
    row.errorMessage = err instanceof Error ? err.message : "Falha na emissão.";
    row.updatedAt = new Date().toISOString();
    await saveFiscal(row);
    return { doc: row, autoIssued: false, queued: true };
  }
}

export async function attachIssuedNfse(input: {
  clinicId: string;
  docId: string;
  number?: string;
  pdf?: ExpenseAttachment | null;
  xml?: ExpenseAttachment | null;
  actor?: FiscalActor;
}): Promise<ClinicFiscalDoc> {
  const doc = await getFiscalDoc(input.docId);
  if (!doc || doc.clinicId !== input.clinicId) throw new Error("Solicitação não encontrada.");
  if (doc.kind !== "nfse") throw new Error("Este documento não é uma NFS-e.");
  if (doc.status === "cancelled") throw new Error("Esta nota foi cancelada.");
  const now = new Date().toISOString();
  if (input.pdf?.buffer?.length) {
    const saved = await saveFile(CLINIC_CASH_BUCKET, `nfse/${input.clinicId}`, {
      name: input.pdf.name || "nfse.pdf",
      type: input.pdf.type || "application/pdf",
      buffer: input.pdf.buffer,
    });
    doc.pdfPath = saved.path;
    doc.pdfStorage = saved.storage;
  }
  if (input.xml?.buffer?.length) {
    const saved = await saveFile(CLINIC_CASH_BUCKET, `nfse/${input.clinicId}`, {
      name: input.xml.name || "nfse.xml",
      type: input.xml.type || "application/xml",
      buffer: input.xml.buffer,
    });
    doc.xmlPath = saved.path;
    doc.xmlStorage = saved.storage;
    doc.xmlName = input.xml.name || "nfse.xml";
  }
  if (!doc.pdfPath && !doc.xmlPath) throw new Error("Anexe o PDF ou o XML da NFS-e emitida.");
  doc.status = "issued";
  doc.issuedAt = now;
  doc.number = input.number?.trim() || doc.number || `NF-${now.slice(0, 10).replace(/-/g, "")}`;
  doc.errorMessage = null;
  doc.updatedAt = now;
  await saveFiscal(doc);
  await logEvent({
    clinicId: input.clinicId,
    kind: "nfse_attach",
    entity: "clinic_fiscal_doc",
    entityId: doc.id,
    beforeCents: null,
    afterCents: doc.amountCents,
    reason: doc.number,
    actorKind: input.actor?.kind ?? null,
    actorId: input.actor?.id ?? null,
    actorEmail: input.actor?.email ?? null,
  });
  return doc;
}

export async function operationalResult(clinicId: string, from: string, to: string) {
  const [encounters, flow] = await Promise.all([
    listEncounters(clinicId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`),
    cashFlow(clinicId, { from, to }),
  ]);
  const summary = productionSummary(encounters);
  const receitas = {
    consultasCents: flow.inCents,
    procedimentosCents: 0,
    outrosCents: 0,
  };
  const despesas = {
    materiaisCents: 0,
    funcionariosCents: 0,
    manutencaoCents: 0,
    taxasCents: 0,
    outrosCents: 0,
  };
  for (const e of flow.expenses) {
    if (e.category === "material_medico" || e.category === "medicamentos" || e.category === "material_escritorio") {
      despesas.materiaisCents += e.amountCents;
    } else if (e.category === "pagamento_funcionario") despesas.funcionariosCents += e.amountCents;
    else if (e.category === "manutencao") despesas.manutencaoCents += e.amountCents;
    else if (e.category === "taxas") despesas.taxasCents += e.amountCents;
    else despesas.outrosCents += e.amountCents;
  }
  const receitaBrutaCents = receitas.consultasCents + receitas.procedimentosCents + receitas.outrosCents;
  const despesaTotalCents =
    despesas.materiaisCents + despesas.funcionariosCents + despesas.manutencaoCents + despesas.taxasCents + despesas.outrosCents;
  return {
    from,
    to,
    receitas,
    despesas,
    receitaBrutaCents,
    despesaTotalCents,
    resultadoCents: receitaBrutaCents - despesaTotalCents,
    clinicShareCents: summary.clinicShareCents,
    doctorShareCents: summary.doctorShareCents,
    producedCents: summary.producedCents,
    receivedCents: summary.receivedCents,
    pendingCents: summary.pendingCents,
    encounterCount: summary.count,
    expenses: flow.expenses,
    byDoctor: summary.byDoctor,
  };
}

export async function encountersForPatientKeys(keys: string[]) {
  const unique = Array.from(new Set(keys.map((k) => k.toLowerCase().trim()).filter(Boolean)));
  const lists = await Promise.all(unique.map((k) => listEncountersByPatientKey(k)));
  const byId = new Map<string, (typeof lists)[0][number]>();
  for (const list of lists) for (const e of list) byId.set(e.id, e);
  return Array.from(byId.values()).sort((a, b) => b.attendedAt.localeCompare(a.attendedAt));
}

export { nfseConfigured };
