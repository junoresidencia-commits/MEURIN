import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getSupabaseAdmin } from "./supabase-admin";
import { createExpense, listCashSessions, listExpenses, type ExpenseAttachment } from "./clinic-cash-store";
import { listPayments } from "./clinic-finance-store";
import { CLINIC_STOCK_BUCKET, saveFile, type StorageKind } from "./doc-storage";
import { stockStatus } from "./clinic-stock-labels";
import type { ClinicCashOrigin, ClinicExpenseCategory, ClinicExpenseMethod } from "./platform-types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "clinic-stock.json");
let tableMissing = false;

function active() {
  return Boolean(getSupabaseAdmin()) && !tableMissing;
}
function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message && /relation .* does not exist|could not find the table/i.test(error.message));
}

export type StockProduct = {
  id: string;
  clinicId: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  minQty: number;
  idealQty: number;
  location: string | null;
  preferredSupplierId: string | null;
  notes: string | null;
  active: boolean;
  avgCostCents: number;
  lastPurchaseAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockLot = {
  id: string;
  clinicId: string;
  productId: string;
  code: string;
  qty: number;
  manufacturedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type StockMoveKind = "in" | "out" | "adjust" | "transfer_out" | "transfer_in" | "inventory";

export type StockMove = {
  id: string;
  clinicId: string;
  productId: string;
  kind: StockMoveKind;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  notes: string | null;
  supplierId: string | null;
  supplierName: string | null;
  unitCostCents: number | null;
  totalCents: number | null;
  expenseId: string | null;
  requestId: string | null;
  lotId: string | null;
  invoiceNumber: string | null;
  attachmentPath: string | null;
  attachmentStorage: StorageKind | null;
  attachmentName: string | null;
  fromClinicId: string | null;
  toClinicId: string | null;
  occurredAt: string;
  actorKind: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type StockSupplier = {
  id: string;
  clinicId: string;
  name: string;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  productsNote: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockRequest = {
  id: string;
  clinicId: string;
  productId: string;
  qty: number;
  priority: "normal" | "urgente" | "critica";
  reason: string | null;
  status: "solicitado" | "aprovado" | "comprado" | "recebido" | "cancelado";
  requestedByName: string;
  requestedByKind: string | null;
  requestedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StockPricePoint = {
  id: string;
  clinicId: string;
  productId: string;
  unitCostCents: number;
  qty: number;
  supplierName: string | null;
  occurredAt: string;
};

export type StockSettings = {
  clinicId: string;
  requireApproval: boolean;
  expiryAlertDays: number[];
  extraCategories: { key: string; label: string }[];
  extraUnits: { key: string; label: string }[];
};

export type StockInventory = {
  id: string;
  clinicId: string;
  status: "open" | "confirmed";
  lines: { productId: string; systemQty: number; countedQty: number; reason: string | null }[];
  justification: string | null;
  actorName: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

type LocalDb = {
  products: StockProduct[];
  lots: StockLot[];
  moves: StockMove[];
  suppliers: StockSupplier[];
  requests: StockRequest[];
  prices: StockPricePoint[];
  settings: StockSettings[];
  inventories: StockInventory[];
  extraCategories: { clinicId: string; key: string; label: string }[];
  extraUnits: { clinicId: string; key: string; label: string }[];
};

const EMPTY: LocalDb = {
  products: [],
  lots: [],
  moves: [],
  suppliers: [],
  requests: [],
  prices: [],
  settings: [],
  inventories: [],
  extraCategories: [],
  extraUnits: [],
};

async function readLocal(): Promise<LocalDb> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<LocalDb>;
    return { ...EMPTY, ...raw, products: raw.products || [], lots: raw.lots || [], moves: raw.moves || [], suppliers: raw.suppliers || [], requests: raw.requests || [], prices: raw.prices || [], settings: raw.settings || [], inventories: raw.inventories || [], extraCategories: raw.extraCategories || [], extraUnits: raw.extraUnits || [] };
  } catch {
    return { ...EMPTY };
  }
}
async function writeLocal(db: LocalDb) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("[clinic-stock] persistência local indisponível", err);
  }
}

export type StockActor = {
  kind?: string | null;
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapProduct(r: Record<string, unknown>): StockProduct {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    name: String(r.name || ""),
    category: String(r.category || "outros"),
    unit: String(r.unit || "unidade"),
    qty: num(r.qty),
    minQty: num(r.min_qty ?? r.minQty),
    idealQty: num(r.ideal_qty ?? r.idealQty),
    location: (r.location as string) ?? null,
    preferredSupplierId: (r.preferred_supplier_id as string) ?? (r.preferredSupplierId as string) ?? null,
    notes: (r.notes as string) ?? null,
    active: r.active !== false,
    avgCostCents: num(r.avg_cost_cents ?? r.avgCostCents),
    lastPurchaseAt: (r.last_purchase_at as string) ?? (r.lastPurchaseAt as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapLot(r: Record<string, unknown>): StockLot {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    productId: String(r.product_id ?? r.productId),
    code: String(r.code || ""),
    qty: num(r.qty),
    manufacturedAt: (r.manufactured_at as string) ?? (r.manufacturedAt as string) ?? null,
    expiresAt: (r.expires_at as string) ?? (r.expiresAt as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}
function mapMove(r: Record<string, unknown>): StockMove {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    productId: String(r.product_id ?? r.productId),
    kind: String(r.kind) as StockMoveKind,
    qty: num(r.qty),
    qtyBefore: num(r.qty_before ?? r.qtyBefore),
    qtyAfter: num(r.qty_after ?? r.qtyAfter),
    reason: (r.reason as string) ?? null,
    notes: (r.notes as string) ?? null,
    supplierId: (r.supplier_id as string) ?? (r.supplierId as string) ?? null,
    supplierName: (r.supplier_name as string) ?? (r.supplierName as string) ?? null,
    unitCostCents: r.unit_cost_cents == null && r.unitCostCents == null ? null : num(r.unit_cost_cents ?? r.unitCostCents),
    totalCents: r.total_cents == null && r.totalCents == null ? null : num(r.total_cents ?? r.totalCents),
    expenseId: (r.expense_id as string) ?? (r.expenseId as string) ?? null,
    requestId: (r.request_id as string) ?? (r.requestId as string) ?? null,
    lotId: (r.lot_id as string) ?? (r.lotId as string) ?? null,
    invoiceNumber: (r.invoice_number as string) ?? (r.invoiceNumber as string) ?? null,
    attachmentPath: (r.attachment_path as string) ?? (r.attachmentPath as string) ?? null,
    attachmentStorage: ((r.attachment_storage as string) ?? (r.attachmentStorage as string) ?? null) as StorageKind | null,
    attachmentName: (r.attachment_name as string) ?? (r.attachmentName as string) ?? null,
    fromClinicId: (r.from_clinic_id as string) ?? (r.fromClinicId as string) ?? null,
    toClinicId: (r.to_clinic_id as string) ?? (r.toClinicId as string) ?? null,
    occurredAt: String(r.occurred_at ?? r.occurredAt),
    actorKind: (r.actor_kind as string) ?? (r.actorKind as string) ?? null,
    actorId: (r.actor_id as string) ?? (r.actorId as string) ?? null,
    actorName: (r.actor_name as string) ?? (r.actorName as string) ?? null,
    actorEmail: (r.actor_email as string) ?? (r.actorEmail as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
  };
}
function mapSupplier(r: Record<string, unknown>): StockSupplier {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    name: String(r.name || ""),
    document: (r.document as string) ?? null,
    phone: (r.phone as string) ?? null,
    whatsapp: (r.whatsapp as string) ?? null,
    email: (r.email as string) ?? null,
    address: (r.address as string) ?? null,
    productsNote: (r.products_note as string) ?? (r.productsNote as string) ?? null,
    notes: (r.notes as string) ?? null,
    active: r.active !== false,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}
function mapRequest(r: Record<string, unknown>): StockRequest {
  return {
    id: String(r.id),
    clinicId: String(r.clinic_id ?? r.clinicId),
    productId: String(r.product_id ?? r.productId),
    qty: num(r.qty),
    priority: String(r.priority || "normal") as StockRequest["priority"],
    reason: (r.reason as string) ?? null,
    status: String(r.status || "solicitado") as StockRequest["status"],
    requestedByName: String(r.requested_by_name ?? r.requestedByName ?? ""),
    requestedByKind: (r.requested_by_kind as string) ?? (r.requestedByKind as string) ?? null,
    requestedById: (r.requested_by_id as string) ?? (r.requestedById as string) ?? null,
    decidedByName: (r.decided_by_name as string) ?? (r.decidedByName as string) ?? null,
    decidedAt: (r.decided_at as string) ?? (r.decidedAt as string) ?? null,
    decisionNote: (r.decision_note as string) ?? (r.decisionNote as string) ?? null,
    createdAt: String(r.created_at ?? r.createdAt),
    updatedAt: String(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}

async function sbAll<T>(table: string, clinicId: string, map: (r: Record<string, unknown>) => T): Promise<T[] | null> {
  if (!active()) return null;
  const sb = getSupabaseAdmin()!;
  const { data, error } = await sb.from(table).select("*").eq("clinic_id", clinicId);
  if (error) {
    if (isMissing(error)) tableMissing = true;
    return null;
  }
  return (data || []).map((r) => map(r as Record<string, unknown>));
}

export async function listStockProducts(clinicId: string, includeInactive = false): Promise<StockProduct[]> {
  const rows = (await sbAll("clinic_stock_products", clinicId, mapProduct)) ?? (await readLocal()).products.filter((p) => p.clinicId === clinicId);
  return rows.filter((p) => includeInactive || p.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getStockProduct(id: string): Promise<StockProduct | null> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_products").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else return data ? mapProduct(data as Record<string, unknown>) : null;
  }
  return (await readLocal()).products.find((p) => p.id === id) ?? null;
}

async function saveProduct(row: StockProduct, insert: boolean) {
  const payload = {
    id: row.id,
    clinic_id: row.clinicId,
    name: row.name,
    category: row.category,
    unit: row.unit,
    qty: row.qty,
    min_qty: row.minQty,
    ideal_qty: row.idealQty,
    location: row.location,
    preferred_supplier_id: row.preferredSupplierId,
    notes: row.notes,
    active: row.active,
    avg_cost_cents: row.avgCostCents,
    last_purchase_at: row.lastPurchaseAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = insert ? await sb.from("clinic_stock_products").insert(payload) : await sb.from("clinic_stock_products").update(payload).eq("id", row.id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.products.findIndex((p) => p.id === row.id);
  if (idx >= 0) local.products[idx] = row;
  else local.products.push(row);
  await writeLocal(local);
}

export async function upsertStockProduct(input: {
  id?: string;
  clinicId: string;
  name: string;
  category: string;
  unit: string;
  qty?: number;
  minQty: number;
  idealQty?: number;
  location?: string | null;
  preferredSupplierId?: string | null;
  notes?: string | null;
  active?: boolean;
}): Promise<StockProduct> {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome do produto.");
  const now = new Date().toISOString();
  const existing = input.id ? await getStockProduct(input.id) : null;
  if (existing && existing.clinicId !== input.clinicId) throw new Error("Produto de outra clínica.");
  const row: StockProduct = existing
    ? {
        ...existing,
        name,
        category: input.category || existing.category,
        unit: input.unit || existing.unit,
        minQty: Math.max(0, num(input.minQty, existing.minQty)),
        idealQty: Math.max(0, num(input.idealQty, existing.idealQty)),
        location: input.location?.trim() || null,
        preferredSupplierId: input.preferredSupplierId || null,
        notes: input.notes?.trim() || null,
        active: input.active ?? existing.active,
        updatedAt: now,
      }
    : {
        id: uuid(),
        clinicId: input.clinicId,
        name,
        category: input.category || "outros",
        unit: input.unit || "unidade",
        qty: Math.max(0, num(input.qty)),
        minQty: Math.max(0, num(input.minQty)),
        idealQty: Math.max(0, num(input.idealQty)),
        location: input.location?.trim() || null,
        preferredSupplierId: input.preferredSupplierId || null,
        notes: input.notes?.trim() || null,
        active: input.active !== false,
        avgCostCents: 0,
        lastPurchaseAt: null,
        createdAt: now,
        updatedAt: now,
      };
  await saveProduct(row, !existing);
  return row;
}

export async function listLots(clinicId: string, productId?: string): Promise<StockLot[]> {
  const rows = (await sbAll("clinic_stock_lots", clinicId, mapLot)) ?? (await readLocal()).lots.filter((l) => l.clinicId === clinicId);
  return rows
    .filter((l) => !productId || l.productId === productId)
    .sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"));
}

async function saveLot(row: StockLot, insert: boolean) {
  const payload = {
    id: row.id,
    clinic_id: row.clinicId,
    product_id: row.productId,
    code: row.code,
    qty: row.qty,
    manufactured_at: row.manufacturedAt,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = insert ? await sb.from("clinic_stock_lots").insert(payload) : await sb.from("clinic_stock_lots").update(payload).eq("id", row.id);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.lots.findIndex((l) => l.id === row.id);
  if (idx >= 0) local.lots[idx] = row;
  else local.lots.push(row);
  await writeLocal(local);
}

async function insertMove(row: StockMove) {
  const payload = {
    id: row.id,
    clinic_id: row.clinicId,
    product_id: row.productId,
    kind: row.kind,
    qty: row.qty,
    qty_before: row.qtyBefore,
    qty_after: row.qtyAfter,
    reason: row.reason,
    notes: row.notes,
    supplier_id: row.supplierId,
    supplier_name: row.supplierName,
    unit_cost_cents: row.unitCostCents,
    total_cents: row.totalCents,
    expense_id: row.expenseId,
    request_id: row.requestId,
    lot_id: row.lotId,
    invoice_number: row.invoiceNumber,
    attachment_path: row.attachmentPath,
    attachment_storage: row.attachmentStorage,
    attachment_name: row.attachmentName,
    from_clinic_id: row.fromClinicId,
    to_clinic_id: row.toClinicId,
    occurred_at: row.occurredAt,
    actor_kind: row.actorKind,
    actor_id: row.actorId,
    actor_name: row.actorName,
    actor_email: row.actorEmail,
    created_at: row.createdAt,
  };
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("clinic_stock_moves").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  local.moves.unshift(row);
  await writeLocal(local);
}

export async function listMoves(clinicId: string, productId?: string): Promise<StockMove[]> {
  const rows = (await sbAll("clinic_stock_moves", clinicId, mapMove)) ?? (await readLocal()).moves.filter((m) => m.clinicId === clinicId);
  return rows
    .filter((m) => !productId || m.productId === productId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function listSuppliers(clinicId: string, includeInactive = false): Promise<StockSupplier[]> {
  const rows = (await sbAll("clinic_stock_suppliers", clinicId, mapSupplier)) ?? (await readLocal()).suppliers.filter((s) => s.clinicId === clinicId);
  return rows.filter((s) => includeInactive || s.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getSupplier(id: string): Promise<StockSupplier | null> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_suppliers").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else return data ? mapSupplier(data as Record<string, unknown>) : null;
  }
  return (await readLocal()).suppliers.find((s) => s.id === id) ?? null;
}

export async function upsertSupplier(input: {
  id?: string;
  clinicId: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  productsNote?: string | null;
  notes?: string | null;
  active?: boolean;
}): Promise<StockSupplier> {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome do fornecedor.");
  const now = new Date().toISOString();
  const existing = input.id ? await getSupplier(input.id) : null;
  if (existing && existing.clinicId !== input.clinicId) throw new Error("Fornecedor de outra clínica.");
  const row: StockSupplier = existing
    ? { ...existing, name, document: input.document?.trim() || null, phone: input.phone?.trim() || null, whatsapp: input.whatsapp?.trim() || null, email: input.email?.trim() || null, address: input.address?.trim() || null, productsNote: input.productsNote?.trim() || null, notes: input.notes?.trim() || null, active: input.active ?? existing.active, updatedAt: now }
    : {
        id: uuid(),
        clinicId: input.clinicId,
        name,
        document: input.document?.trim() || null,
        phone: input.phone?.trim() || null,
        whatsapp: input.whatsapp?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        productsNote: input.productsNote?.trim() || null,
        notes: input.notes?.trim() || null,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
  const payload = {
    id: row.id,
    clinic_id: row.clinicId,
    name: row.name,
    document: row.document,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    products_note: row.productsNote,
    notes: row.notes,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { error } = existing ? await sb.from("clinic_stock_suppliers").update(payload).eq("id", row.id) : await sb.from("clinic_stock_suppliers").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return row;
  }
  const local = await readLocal();
  const idx = local.suppliers.findIndex((s) => s.id === row.id);
  if (idx >= 0) local.suppliers[idx] = row;
  else local.suppliers.push(row);
  await writeLocal(local);
  return row;
}

export async function getStockSettings(clinicId: string): Promise<StockSettings> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_settings").select("*").eq("clinic_id", clinicId).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
    } else if (data) {
      const r = data as Record<string, unknown>;
      return {
        clinicId,
        requireApproval: r.require_approval !== false,
        expiryAlertDays: Array.isArray(r.expiry_alert_days) ? (r.expiry_alert_days as number[]) : [90, 60, 30],
        extraCategories: Array.isArray(r.extra_categories) ? (r.extra_categories as { key: string; label: string }[]) : [],
        extraUnits: Array.isArray(r.extra_units) ? (r.extra_units as { key: string; label: string }[]) : [],
      };
    }
  }
  const local = (await readLocal()).settings.find((s) => s.clinicId === clinicId);
  if (local) {
    return {
      clinicId,
      requireApproval: local.requireApproval !== false,
      expiryAlertDays: local.expiryAlertDays?.length ? local.expiryAlertDays : [90, 60, 30],
      extraCategories: local.extraCategories || [],
      extraUnits: local.extraUnits || [],
    };
  }
  return { clinicId, requireApproval: true, expiryAlertDays: [90, 60, 30], extraCategories: [], extraUnits: [] };
}

export async function saveStockSettings(clinicId: string, patch: Partial<StockSettings>): Promise<StockSettings> {
  const cur = await getStockSettings(clinicId);
  const next: StockSettings = {
    clinicId,
    requireApproval: patch.requireApproval ?? cur.requireApproval,
    expiryAlertDays: patch.expiryAlertDays?.length ? patch.expiryAlertDays : cur.expiryAlertDays,
    extraCategories: patch.extraCategories ?? cur.extraCategories ?? [],
    extraUnits: patch.extraUnits ?? cur.extraUnits ?? [],
  };
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("clinic_stock_settings").upsert({
      clinic_id: clinicId,
      require_approval: next.requireApproval,
      expiry_alert_days: next.expiryAlertDays,
      extra_categories: next.extraCategories,
      extra_units: next.extraUnits,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return next;
  }
  const local = await readLocal();
  const idx = local.settings.findIndex((s) => s.clinicId === clinicId);
  if (idx >= 0) local.settings[idx] = next;
  else local.settings.push(next);
  await writeLocal(local);
  return next;
}

function uniqueCatalog(items: { key: string; label: string }[]) {
  const seen = new Set<string>();
  const out: { key: string; label: string }[] = [];
  for (const item of items) {
    if (!item?.key || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push({ key: item.key, label: item.label || item.key });
  }
  return out;
}

export async function extraCatalog(clinicId: string) {
  const settings = await getStockSettings(clinicId);
  const local = await readLocal();
  return {
    categories: uniqueCatalog([
      ...(settings.extraCategories || []),
      ...local.extraCategories.filter((c) => c.clinicId === clinicId).map(({ key, label }) => ({ key, label })),
    ]),
    units: uniqueCatalog([
      ...(settings.extraUnits || []),
      ...local.extraUnits.filter((u) => u.clinicId === clinicId).map(({ key, label }) => ({ key, label })),
    ]),
  };
}

export async function addCatalogItem(clinicId: string, kind: "category" | "unit", label: string) {
  const name = label.trim();
  if (!name) throw new Error("Informe o nome.");
  const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || uuid().slice(0, 8);
  const cur = await extraCatalog(clinicId);
  if (kind === "category") {
    await saveStockSettings(clinicId, { extraCategories: uniqueCatalog([...cur.categories, { key, label: name }]) });
  } else {
    await saveStockSettings(clinicId, { extraUnits: uniqueCatalog([...cur.units, { key, label: name }]) });
  }
  return { key, label: name };
}

function expenseCategoryFromStock(category: string): ClinicExpenseCategory {
  if (category === "medicamentos") return "medicamentos";
  if (category === "material_escritorio" || category === "impressos") return "material_escritorio";
  if (category === "limpeza" || category === "higiene") return "limpeza";
  if (category === "material_medico" || category === "material_enfermagem") return "material_medico";
  return "outros";
}

export async function availablePhysicalCashCents(clinicId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const [sessions, payments, expenses] = await Promise.all([listCashSessions(clinicId), listPayments(clinicId), listExpenses(clinicId, day, day)]);
  const previous = sessions.filter((s) => s.day < day).sort((a, b) => b.day.localeCompare(a.day))[0];
  const opening = previous?.countedCents ?? 0;
  const cashIn = payments.filter((p) => p.createdAt.slice(0, 10) === day && p.method === "cash" && p.amountCents > 0).reduce((s, p) => s + p.amountCents, 0);
  const cashOut = expenses.filter((e) => !e.voidedAt && (e.origin === "caixa_fisico" || e.method === "dinheiro")).reduce((s, e) => s + e.amountCents, 0);
  return opening + cashIn - cashOut;
}

async function consumeLots(clinicId: string, productId: string, qty: number): Promise<string | null> {
  const lots = (await listLots(clinicId, productId)).filter((l) => l.qty > 0);
  let left = qty;
  const firstId: string | null = lots[0]?.id ?? null;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.qty, left);
    lot.qty = Math.round((lot.qty - take) * 1000) / 1000;
    left = Math.round((left - take) * 1000) / 1000;
    await saveLot(lot, false);
  }
  return firstId;
}

async function addLot(input: {
  clinicId: string;
  productId: string;
  code?: string;
  qty: number;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
}): Promise<StockLot> {
  const lots = await listLots(input.clinicId, input.productId);
  const code = (input.code || "").trim();
  const existing = code ? lots.find((l) => l.code === code) : undefined;
  if (existing) {
    existing.qty = Math.round((existing.qty + input.qty) * 1000) / 1000;
    if (input.expiresAt) existing.expiresAt = input.expiresAt;
    if (input.manufacturedAt) existing.manufacturedAt = input.manufacturedAt;
    await saveLot(existing, false);
    return existing;
  }
  const row: StockLot = {
    id: uuid(),
    clinicId: input.clinicId,
    productId: input.productId,
    code: code || `L-${uuid().slice(0, 6).toUpperCase()}`,
    qty: input.qty,
    manufacturedAt: input.manufacturedAt || null,
    expiresAt: input.expiresAt || null,
    createdAt: new Date().toISOString(),
  };
  await saveLot(row, true);
  return row;
}

async function insertPrice(point: StockPricePoint) {
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("clinic_stock_prices").insert({
      id: point.id,
      clinic_id: point.clinicId,
      product_id: point.productId,
      unit_cost_cents: point.unitCostCents,
      qty: point.qty,
      supplier_name: point.supplierName,
      occurred_at: point.occurredAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  local.prices.unshift(point);
  await writeLocal(local);
}

export async function listPriceHistory(clinicId: string, productId: string): Promise<StockPricePoint[]> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_prices").select("*").eq("clinic_id", clinicId).eq("product_id", productId).order("occurred_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => ({
        id: String((r as { id: string }).id),
        clinicId,
        productId,
        unitCostCents: Number((r as { unit_cost_cents: number }).unit_cost_cents),
        qty: Number((r as { qty: number }).qty),
        supplierName: (r as { supplier_name?: string | null }).supplier_name ?? null,
        occurredAt: String((r as { occurred_at: string }).occurred_at),
      }));
    }
  }
  return (await readLocal()).prices.filter((p) => p.clinicId === clinicId && p.productId === productId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function receiveStock(input: {
  clinicId: string;
  clinicName: string;
  productId: string;
  qty: number;
  occurredAt?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  totalCents?: number;
  method?: ClinicExpenseMethod;
  origin?: ClinicCashOrigin;
  createExpense?: boolean;
  fromCash?: boolean;
  confirmCash?: boolean;
  invoiceNumber?: string | null;
  notes?: string | null;
  lotCode?: string | null;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
  requestId?: string | null;
  attachment?: ExpenseAttachment | null;
  actor?: StockActor;
}): Promise<{ product: StockProduct; move: StockMove; expenseId: string | null; cashAvailableCents: number }> {
  const qty = num(input.qty);
  if (qty <= 0) throw new Error("Informe a quantidade de entrada.");
  const product = await getStockProduct(input.productId);
  if (!product || product.clinicId !== input.clinicId) throw new Error("Produto não encontrado nesta clínica.");
  const cashAvailableCents = await availablePhysicalCashCents(input.clinicId);
  const totalCents = Math.max(0, Math.round(num(input.totalCents)));
  const unitCost = qty ? Math.round(totalCents / qty) : 0;
  if (input.fromCash && input.createExpense !== false) {
    const valor = (totalCents / 100).toFixed(2).replace(".", ",");
    if (!input.confirmCash) throw new Error(`Confirme a retirada de R$ ${valor} do caixa.`);
    if (totalCents > cashAvailableCents) {
      const disp = (cashAvailableCents / 100).toFixed(2).replace(".", ",");
      throw new Error(`Caixa físico tem R$ ${disp} — insuficiente para retirar R$ ${valor}.`);
    }
  }
  let expenseId: string | null = null;
  const supplier = input.supplierId ? await getSupplier(input.supplierId) : null;
  const supplierName = supplier?.name || input.supplierName?.trim() || null;
  if (input.createExpense && totalCents > 0) {
    const expense = await createExpense({
      clinicId: input.clinicId,
      occurredAt: input.occurredAt,
      amountCents: totalCents,
      category: expenseCategoryFromStock(product.category),
      description: `Compra de estoque: ${qty} ${product.unit} de ${product.name}${supplierName ? ` · ${supplierName}` : ""}`,
      method: input.fromCash ? "dinheiro" : input.method || "dinheiro",
      origin: input.fromCash ? "caixa_fisico" : input.origin || "conta_clinica",
      responsibleName: input.actor?.name || "Equipe",
      locationLabel: input.clinicName,
      notes: input.notes || null,
      attachment: input.attachment,
      recordedByKind: input.actor?.kind,
      recordedById: input.actor?.id,
      recordedByEmail: input.actor?.email,
    });
    expenseId = expense.id;
  }
  let attachmentPath: string | null = null;
  let attachmentStorage: StorageKind | null = null;
  let attachmentName: string | null = null;
  if (!expenseId && input.attachment?.buffer?.length) {
    const saved = await saveFile(CLINIC_STOCK_BUCKET, `compras/${input.clinicId}`, {
      name: input.attachment.name || "comprovante",
      type: input.attachment.type,
      buffer: input.attachment.buffer,
    });
    attachmentPath = saved.path;
    attachmentStorage = saved.storage;
    attachmentName = input.attachment.name || "comprovante";
  }
  let lotId: string | null = null;
  if (input.lotCode || input.expiresAt) {
    const lot = await addLot({
      clinicId: input.clinicId,
      productId: product.id,
      code: input.lotCode || undefined,
      qty,
      manufacturedAt: input.manufacturedAt,
      expiresAt: input.expiresAt,
    });
    lotId = lot.id;
  }
  const qtyBefore = product.qty;
  product.qty = Math.round((product.qty + qty) * 1000) / 1000;
  if (totalCents > 0) {
    const oldValue = qtyBefore * product.avgCostCents;
    product.avgCostCents = product.qty ? Math.round((oldValue + totalCents) / product.qty) : unitCost;
    product.lastPurchaseAt = input.occurredAt ? new Date(input.occurredAt).toISOString() : new Date().toISOString();
  }
  product.updatedAt = new Date().toISOString();
  await saveProduct(product, false);
  const now = new Date().toISOString();
  const move: StockMove = {
    id: uuid(),
    clinicId: input.clinicId,
    productId: product.id,
    kind: "in",
    qty,
    qtyBefore,
    qtyAfter: product.qty,
    reason: "compra",
    notes: input.notes || null,
    supplierId: supplier?.id || input.supplierId || null,
    supplierName,
    unitCostCents: totalCents > 0 ? unitCost : null,
    totalCents: totalCents > 0 ? totalCents : null,
    expenseId,
    requestId: input.requestId || null,
    lotId,
    invoiceNumber: input.invoiceNumber?.trim() || null,
    attachmentPath,
    attachmentStorage,
    attachmentName,
    fromClinicId: null,
    toClinicId: null,
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
    actorKind: input.actor?.kind ?? null,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    actorEmail: input.actor?.email ?? null,
    createdAt: now,
  };
  await insertMove(move);
  if (totalCents > 0) {
    await insertPrice({
      id: uuid(),
      clinicId: input.clinicId,
      productId: product.id,
      unitCostCents: unitCost,
      qty,
      supplierName,
      occurredAt: move.occurredAt,
    });
  }
  if (input.requestId) {
    const req = await getRequest(input.requestId);
    if (req && req.clinicId === input.clinicId) {
      req.status = "recebido";
      req.updatedAt = now;
      await saveRequest(req);
    }
  }
  return { product, move, expenseId, cashAvailableCents };
}

export async function stockOut(input: {
  clinicId: string;
  productId: string;
  qty: number;
  reason: string;
  notes?: string | null;
  occurredAt?: string;
  actor?: StockActor;
}): Promise<{ product: StockProduct; move: StockMove }> {
  const qty = num(input.qty);
  if (qty <= 0) throw new Error("Informe a quantidade de saída.");
  const product = await getStockProduct(input.productId);
  if (!product || product.clinicId !== input.clinicId) throw new Error("Produto não encontrado nesta clínica.");
  if (qty > product.qty) throw new Error(`Só há ${product.qty} ${product.unit} de ${product.name}.`);
  const lotId = await consumeLots(input.clinicId, product.id, qty);
  const qtyBefore = product.qty;
  product.qty = Math.round((product.qty - qty) * 1000) / 1000;
  product.updatedAt = new Date().toISOString();
  await saveProduct(product, false);
  const now = new Date().toISOString();
  const move: StockMove = {
    id: uuid(),
    clinicId: input.clinicId,
    productId: product.id,
    kind: input.reason === "ajuste" ? "adjust" : "out",
    qty,
    qtyBefore,
    qtyAfter: product.qty,
    reason: input.reason,
    notes: input.notes || null,
    supplierId: null,
    supplierName: null,
    unitCostCents: product.avgCostCents || null,
    totalCents: Math.round(qty * product.avgCostCents) || null,
    expenseId: null,
    requestId: null,
    lotId,
    invoiceNumber: null,
    attachmentPath: null,
    attachmentStorage: null,
    attachmentName: null,
    fromClinicId: null,
    toClinicId: null,
    occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
    actorKind: input.actor?.kind ?? null,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    actorEmail: input.actor?.email ?? null,
    createdAt: now,
  };
  await insertMove(move);
  return { product, move };
}

export async function adjustStock(input: {
  clinicId: string;
  productId: string;
  countedQty: number;
  reason: string;
  notes?: string | null;
  actor?: StockActor;
}): Promise<{ product: StockProduct; move: StockMove; difference: number }> {
  const product = await getStockProduct(input.productId);
  if (!product || product.clinicId !== input.clinicId) throw new Error("Produto não encontrado nesta clínica.");
  const counted = num(input.countedQty);
  if (counted < 0) throw new Error("A contagem não pode ser negativa.");
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Informe o motivo do ajuste.");
  const difference = Math.round((counted - product.qty) * 1000) / 1000;
  if (difference === 0) {
    const last = (await listMoves(input.clinicId, product.id))[0];
    const noop: StockMove =
      last ||
      ({
        id: "",
        clinicId: product.clinicId,
        productId: product.id,
        kind: "adjust",
        qty: 0,
        qtyBefore: product.qty,
        qtyAfter: product.qty,
        reason: input.reason,
        notes: "Sem diferença",
        supplierId: null,
        supplierName: null,
        unitCostCents: null,
        totalCents: null,
        expenseId: null,
        requestId: null,
        lotId: null,
        invoiceNumber: null,
        attachmentPath: null,
        attachmentStorage: null,
        attachmentName: null,
        fromClinicId: null,
        toClinicId: null,
        occurredAt: new Date().toISOString(),
        actorKind: input.actor?.kind ?? null,
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? null,
        actorEmail: input.actor?.email ?? null,
        createdAt: new Date().toISOString(),
      } satisfies StockMove);
    return { product, move: noop, difference: 0 };
  }
  if (difference < 0) {
    const out = await stockOut({
      clinicId: input.clinicId,
      productId: product.id,
      qty: -difference,
      reason,
      notes: input.notes || `Ajuste: sistema ${product.qty} → ${counted}`,
      actor: input.actor,
    });
    return { product: out.product, move: { ...out.move, kind: "adjust" }, difference };
  }
  const qtyBefore = product.qty;
  product.qty = counted;
  product.updatedAt = new Date().toISOString();
  await saveProduct(product, false);
  const now = new Date().toISOString();
  const move: StockMove = {
    id: uuid(),
    clinicId: input.clinicId,
    productId: product.id,
    kind: "adjust",
    qty: difference,
    qtyBefore,
    qtyAfter: counted,
    reason,
    notes: input.notes || `Ajuste: sistema ${qtyBefore} → ${counted}`,
    supplierId: null,
    supplierName: null,
    unitCostCents: null,
    totalCents: null,
    expenseId: null,
    requestId: null,
    lotId: null,
    invoiceNumber: null,
    attachmentPath: null,
    attachmentStorage: null,
    attachmentName: null,
    fromClinicId: null,
    toClinicId: null,
    occurredAt: now,
    actorKind: input.actor?.kind ?? null,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    actorEmail: input.actor?.email ?? null,
    createdAt: now,
  };
  await insertMove(move);
  return { product, move, difference };
}

export async function transferStock(input: {
  fromClinicId: string;
  toClinicId: string;
  productId: string;
  qty: number;
  notes?: string | null;
  actor?: StockActor;
}): Promise<{ from: StockProduct; to: StockProduct }> {
  if (input.fromClinicId === input.toClinicId) throw new Error("Origem e destino são a mesma clínica.");
  const qty = num(input.qty);
  if (qty <= 0) throw new Error("Informe a quantidade.");
  const from = await getStockProduct(input.productId);
  if (!from || from.clinicId !== input.fromClinicId) throw new Error("Produto não encontrado na origem.");
  if (qty > from.qty) throw new Error("Quantidade insuficiente na origem.");
  const destList = await listStockProducts(input.toClinicId, true);
  let to = destList.find((p) => p.name.toLowerCase() === from.name.toLowerCase() && p.unit === from.unit);
  if (!to) {
    to = await upsertStockProduct({
      clinicId: input.toClinicId,
      name: from.name,
      category: from.category,
      unit: from.unit,
      qty: 0,
      minQty: from.minQty,
      idealQty: from.idealQty,
    });
  }
  await consumeLots(input.fromClinicId, from.id, qty);
  const fromBefore = from.qty;
  from.qty = Math.round((from.qty - qty) * 1000) / 1000;
  from.updatedAt = new Date().toISOString();
  await saveProduct(from, false);
  const toBefore = to.qty;
  to.qty = Math.round((to.qty + qty) * 1000) / 1000;
  to.updatedAt = new Date().toISOString();
  await saveProduct(to, false);
  const now = new Date().toISOString();
  const base = {
    qty,
    reason: "transferencia",
    notes: input.notes || null,
    supplierId: null,
    supplierName: null,
    unitCostCents: from.avgCostCents || null,
    totalCents: null,
    expenseId: null,
    requestId: null,
    lotId: null,
    invoiceNumber: null,
    attachmentPath: null,
    attachmentStorage: null,
    attachmentName: null,
    fromClinicId: input.fromClinicId,
    toClinicId: input.toClinicId,
    occurredAt: now,
    actorKind: input.actor?.kind ?? null,
    actorId: input.actor?.id ?? null,
    actorName: input.actor?.name ?? null,
    actorEmail: input.actor?.email ?? null,
    createdAt: now,
  };
  await insertMove({ id: uuid(), clinicId: input.fromClinicId, productId: from.id, kind: "transfer_out", qtyBefore: fromBefore, qtyAfter: from.qty, ...base });
  await insertMove({ id: uuid(), clinicId: input.toClinicId, productId: to.id, kind: "transfer_in", qtyBefore: toBefore, qtyAfter: to.qty, ...base });
  return { from, to };
}

export async function listRequests(clinicId: string): Promise<StockRequest[]> {
  const rows = (await sbAll("clinic_stock_requests", clinicId, mapRequest)) ?? (await readLocal()).requests.filter((r) => r.clinicId === clinicId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRequest(id: string): Promise<StockRequest | null> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_requests").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else return data ? mapRequest(data as Record<string, unknown>) : null;
  }
  return (await readLocal()).requests.find((r) => r.id === id) ?? null;
}

async function saveRequest(row: StockRequest) {
  const payload = {
    id: row.id,
    clinic_id: row.clinicId,
    product_id: row.productId,
    qty: row.qty,
    priority: row.priority,
    reason: row.reason,
    status: row.status,
    requested_by_name: row.requestedByName,
    requested_by_kind: row.requestedByKind,
    requested_by_id: row.requestedById,
    decided_by_name: row.decidedByName,
    decided_at: row.decidedAt,
    decision_note: row.decisionNote,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
  if (active()) {
    const sb = getSupabaseAdmin()!;
    const { data } = await sb.from("clinic_stock_requests").select("id").eq("id", row.id).maybeSingle();
    const { error } = data ? await sb.from("clinic_stock_requests").update(payload).eq("id", row.id) : await sb.from("clinic_stock_requests").insert(payload);
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return;
  }
  const local = await readLocal();
  const idx = local.requests.findIndex((r) => r.id === row.id);
  if (idx >= 0) local.requests[idx] = row;
  else local.requests.unshift(row);
  await writeLocal(local);
}

export async function createPurchaseRequest(input: {
  clinicId: string;
  productId: string;
  qty: number;
  priority?: StockRequest["priority"];
  reason?: string | null;
  actor?: StockActor;
}): Promise<StockRequest> {
  const product = await getStockProduct(input.productId);
  if (!product || product.clinicId !== input.clinicId) throw new Error("Produto não encontrado nesta clínica.");
  const qty = num(input.qty);
  if (qty <= 0) throw new Error("Informe a quantidade solicitada.");
  const now = new Date().toISOString();
  const row: StockRequest = {
    id: uuid(),
    clinicId: input.clinicId,
    productId: product.id,
    qty,
    priority: input.priority || "normal",
    reason: input.reason?.trim() || (product.qty <= product.minQty ? "Estoque baixo" : null),
    status: "solicitado",
    requestedByName: input.actor?.name || "Equipe",
    requestedByKind: input.actor?.kind ?? null,
    requestedById: input.actor?.id ?? null,
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: now,
    updatedAt: now,
  };
  await saveRequest(row);
  return row;
}

export async function decidePurchaseRequest(input: {
  clinicId: string;
  requestId: string;
  action: "approve" | "reject";
  note?: string | null;
  actor?: StockActor;
}): Promise<StockRequest> {
  const row = await getRequest(input.requestId);
  if (!row || row.clinicId !== input.clinicId) throw new Error("Solicitação não encontrada.");
  if (row.status !== "solicitado") throw new Error("Esta solicitação já foi decidida.");
  row.status = input.action === "approve" ? "aprovado" : "cancelado";
  row.decidedByName = input.actor?.name || null;
  row.decidedAt = new Date().toISOString();
  row.decisionNote = input.note?.trim() || null;
  row.updatedAt = row.decidedAt;
  await saveRequest(row);
  return row;
}

export async function confirmInventory(input: {
  clinicId: string;
  lines: { productId: string; countedQty: number; reason?: string | null }[];
  justification?: string | null;
  actor?: StockActor;
}): Promise<StockInventory> {
  const products = await listStockProducts(input.clinicId, true);
  const lines = input.lines.map((l) => {
    const p = products.find((x) => x.id === l.productId);
    return { productId: l.productId, systemQty: p?.qty ?? 0, countedQty: num(l.countedQty), reason: l.reason || null };
  });
  const diffs = lines.filter((l) => Math.round((l.countedQty - l.systemQty) * 1000) / 1000 !== 0);
  if (diffs.length && String(input.justification || "").trim().length < 8) {
    throw new Error("Há divergências. Informe a justificativa do inventário.");
  }
  for (const line of diffs) {
    const reason = line.reason?.trim() || input.justification || "inventario";
    await adjustStock({
      clinicId: input.clinicId,
      productId: line.productId,
      countedQty: line.countedQty,
      reason,
      notes: "Inventário",
      actor: input.actor,
    });
  }
  const now = new Date().toISOString();
  const inv: StockInventory = {
    id: uuid(),
    clinicId: input.clinicId,
    status: "confirmed",
    lines,
    justification: input.justification?.trim() || null,
    actorName: input.actor?.name || null,
    createdAt: now,
    confirmedAt: now,
  };
  if (active()) {
    const { error } = await getSupabaseAdmin()!.from("clinic_stock_inventories").insert({
      id: inv.id,
      clinic_id: inv.clinicId,
      status: inv.status,
      lines: inv.lines,
      justification: inv.justification,
      actor_name: inv.actorName,
      created_at: inv.createdAt,
      confirmed_at: inv.confirmedAt,
    });
    if (error && !isMissing(error)) throw error;
    if (error && isMissing(error)) tableMissing = true;
    else if (!error) return inv;
  }
  const local = await readLocal();
  local.inventories.unshift(inv);
  await writeLocal(local);
  return inv;
}

export function decorateProduct(p: StockProduct, lots: StockLot[], settings: StockSettings) {
  const status = stockStatus(p.qty, p.minQty);
  const today = new Date().toISOString().slice(0, 10);
  const productLots = lots.filter((l) => l.productId === p.id && l.qty > 0);
  const nearest = productLots.map((l) => l.expiresAt).filter(Boolean).sort()[0] || null;
  let expiry: "ok" | "90" | "60" | "30" | "expired" = "ok";
  if (nearest) {
    const days = Math.ceil((Date.parse(nearest) - Date.parse(today)) / 86400000);
    if (days < 0) expiry = "expired";
    else if (settings.expiryAlertDays.includes(30) && days <= 30) expiry = "30";
    else if (settings.expiryAlertDays.includes(60) && days <= 60) expiry = "60";
    else if (settings.expiryAlertDays.includes(90) && days <= 90) expiry = "90";
  }
  return { ...p, status, lots: productLots, nearestExpiry: nearest, expiry };
}

export async function stockDashboard(clinicId: string) {
  const [products, lots, settings, moves, requests] = await Promise.all([
    listStockProducts(clinicId),
    listLots(clinicId),
    getStockSettings(clinicId),
    listMoves(clinicId),
    listRequests(clinicId),
  ]);
  const decorated = products.map((p) => decorateProduct(p, lots, settings));
  const month = new Date().toISOString().slice(0, 7);
  const monthIns = moves.filter((m) => m.kind === "in" && m.occurredAt.slice(0, 7) === month);
  const low = decorated.filter((p) => p.status === "baixo");
  const crit = decorated.filter((p) => p.status === "critico");
  const zero = decorated.filter((p) => p.status === "zerado");
  const expiring = decorated.filter((p) => p.expiry === "30" || p.expiry === "expired" || p.expiry === "60");
  return {
    settings,
    counts: {
      products: decorated.length,
      low: low.length,
      critical: crit.length,
      zero: zero.length,
      expiring: expiring.length,
      monthPurchases: monthIns.length,
      monthSpentCents: monthIns.reduce((s, m) => s + (m.totalCents || 0), 0),
    },
    attention: [...zero, ...crit, ...low, ...expiring.filter((p) => p.status === "normal")].slice(0, 12),
    products: decorated,
    requests: requests.filter((r) => r.status === "solicitado" || r.status === "aprovado"),
    cashAvailableCents: await availablePhysicalCashCents(clinicId),
  };
}

export async function stockAlerts(clinicId: string) {
  const dash = await stockDashboard(clinicId);
  const items: { tone: "red" | "yellow"; text: string }[] = [];
  if (dash.counts.zero) items.push({ tone: "red", text: `${dash.counts.zero} produto(s) sem estoque` });
  if (dash.counts.critical) items.push({ tone: "red", text: `${dash.counts.critical} produto(s) em nível crítico` });
  if (dash.counts.low) items.push({ tone: "yellow", text: `${dash.counts.low} produto(s) abaixo do mínimo` });
  if (dash.counts.expiring) items.push({ tone: "yellow", text: `${dash.counts.expiring} produto(s) próximos do vencimento` });
  const open = dash.requests.filter((r) => r.status === "solicitado");
  if (open.length) items.push({ tone: "yellow", text: `${open.length} solicitação(ões) de compra aguardando` });
  for (const p of dash.attention.slice(0, 6)) {
    if (p.status === "baixo" || p.status === "critico" || p.status === "zerado") {
      items.push({ tone: p.status === "baixo" ? "yellow" : "red", text: `Atenção: ${p.name} está abaixo do estoque mínimo.` });
    }
  }
  return items;
}

export async function getStockMove(id: string): Promise<StockMove | null> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_moves").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return null;
    } else return data ? mapMove(data as Record<string, unknown>) : null;
  }
  return (await readLocal()).moves.find((m) => m.id === id) ?? null;
}

export async function listInventories(clinicId: string): Promise<StockInventory[]> {
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_inventories").select("*").eq("clinic_id", clinicId).order("created_at", { ascending: false });
    if (error) {
      if (isMissing(error)) tableMissing = true;
      else return [];
    } else {
      return (data || []).map((r) => {
        const row = r as Record<string, unknown>;
        return {
          id: String(row.id),
          clinicId: String(row.clinic_id),
          status: (row.status as StockInventory["status"]) || "confirmed",
          lines: Array.isArray(row.lines) ? (row.lines as StockInventory["lines"]) : [],
          justification: (row.justification as string) ?? null,
          actorName: (row.actor_name as string) ?? null,
          createdAt: String(row.created_at),
          confirmedAt: (row.confirmed_at as string) ?? null,
        };
      });
    }
  }
  return (await readLocal()).inventories.filter((i) => i.clinicId === clinicId);
}

export function priceSummary(points: StockPricePoint[]) {
  if (!points.length) return { last: null as number | null, min: null as number | null, max: null as number | null, avg: null as number | null };
  const costs = points.map((p) => p.unitCostCents);
  return {
    last: costs[0],
    min: Math.min(...costs),
    max: Math.max(...costs),
    avg: Math.round(costs.reduce((s, c) => s + c, 0) / costs.length),
  };
}

export async function supplierHistory(clinicId: string, supplierId: string) {
  const moves = (await listMoves(clinicId)).filter((m) => m.kind === "in" && m.supplierId === supplierId);
  const products = await listStockProducts(clinicId, true);
  const byName = new Map(products.map((p) => [p.id, p]));
  return {
    purchases: moves.map((m) => ({
      id: m.id,
      occurredAt: m.occurredAt,
      productName: byName.get(m.productId)?.name || m.productId,
      qty: m.qty,
      unit: byName.get(m.productId)?.unit || "",
      totalCents: m.totalCents,
    })),
    totalCents: moves.reduce((s, m) => s + (m.totalCents || 0), 0),
    lastPurchaseAt: moves[0]?.occurredAt || null,
  };
}

function inRange(iso: string, from?: string, to?: string) {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export async function stockReportData(
  clinicId: string,
  opts: {
    kind?: string;
    from?: string;
    to?: string;
    productId?: string;
    category?: string;
    supplierId?: string;
    actorName?: string;
  }
) {
  const [products, lots, settings, moves, suppliers] = await Promise.all([
    listStockProducts(clinicId, true),
    listLots(clinicId),
    getStockSettings(clinicId),
    listMoves(clinicId),
    listSuppliers(clinicId, true),
  ]);
  let prices: StockPricePoint[] = [];
  if (active()) {
    const { data, error } = await getSupabaseAdmin()!.from("clinic_stock_prices").select("*").eq("clinic_id", clinicId);
    if (error) {
      if (isMissing(error)) tableMissing = true;
    } else {
      prices = (data || []).map((r) => ({
        id: String((r as { id: string }).id),
        clinicId,
        productId: String((r as { product_id: string }).product_id),
        unitCostCents: Number((r as { unit_cost_cents: number }).unit_cost_cents),
        qty: Number((r as { qty: number }).qty),
        supplierName: (r as { supplier_name?: string | null }).supplier_name ?? null,
        occurredAt: String((r as { occurred_at: string }).occurred_at),
      }));
    }
  }
  if (!prices.length) {
    prices = (await readLocal()).prices.filter((p) => p.clinicId === clinicId);
  }
  const decorated = products.map((p) => decorateProduct(p, lots, settings));
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name || id;
  const filteredMoves = moves.filter((m) => {
    if (opts.productId && m.productId !== opts.productId) return false;
    if (opts.supplierId && m.supplierId !== opts.supplierId) return false;
    if (opts.actorName && !(m.actorName || "").toLowerCase().includes(opts.actorName.toLowerCase())) return false;
    if (!inRange(m.occurredAt, opts.from, opts.to)) return false;
    const prod = products.find((p) => p.id === m.productId);
    if (opts.category && prod && prod.category !== opts.category) return false;
    return true;
  });
  const kind = opts.kind || "atual";
  const rows: { col1: string; col2: string; col3: string; col4: string; col5: string }[] = [];
  if (kind === "atual") {
    for (const p of decorated.filter((x) => !opts.category || x.category === opts.category).filter((x) => !opts.productId || x.id === opts.productId)) {
      rows.push({
        col1: p.name,
        col2: p.category,
        col3: `${p.qty} ${p.unit}`,
        col4: stockStatus(p.qty, p.minQty),
        col5: p.avgCostCents ? (p.avgCostCents / 100).toFixed(2) : "—",
      });
    }
  } else if (kind === "precos") {
    const list = opts.productId ? prices.filter((p) => p.productId === opts.productId) : prices;
    for (const p of list.filter((x) => inRange(x.occurredAt, opts.from, opts.to))) {
      rows.push({
        col1: nameOf(p.productId),
        col2: p.occurredAt.slice(0, 10),
        col3: (p.unitCostCents / 100).toFixed(2),
        col4: String(p.qty),
        col5: p.supplierName || "—",
      });
    }
  } else if (kind === "vencidos") {
    for (const p of decorated.filter((x) => x.expiry === "expired" || x.expiry === "30" || x.expiry === "60" || x.expiry === "90")) {
      rows.push({
        col1: p.name,
        col2: p.nearestExpiry || "—",
        col3: p.expiry === "expired" ? "Vencido" : `Vence em ${p.expiry} dias`,
        col4: `${p.qty} ${p.unit}`,
        col5: p.lots.map((l) => l.code).join(", "),
      });
    }
  } else {
    const want =
      kind === "entradas" ? ["in"] :
      kind === "saidas" ? ["out"] :
      kind === "perdas" ? ["out"] :
      kind === "compras" || kind === "gastos" ? ["in"] :
      ["in", "out", "adjust", "transfer_out", "transfer_in", "inventory"];
    for (const m of filteredMoves.filter((x) => want.includes(x.kind))) {
      if (kind === "perdas" && m.reason !== "perda" && m.reason !== "vencido" && m.reason !== "danificado") continue;
      if ((kind === "compras" || kind === "gastos") && !m.totalCents) continue;
      rows.push({
        col1: nameOf(m.productId),
        col2: m.occurredAt.slice(0, 16).replace("T", " "),
        col3: `${m.kind} ${m.qty}`,
        col4: m.totalCents != null ? (m.totalCents / 100).toFixed(2) : "—",
        col5: m.actorName || m.supplierName || m.reason || "—",
      });
    }
  }
  return {
    kind,
    clinicId,
    from: opts.from || "",
    to: opts.to || "",
    suppliers: suppliers.map((s) => s.name),
    rows,
    products: decorated,
    moves: filteredMoves,
  };
}
