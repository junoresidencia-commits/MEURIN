import { NextResponse } from "next/server";
import { clinicStockPerm, clinicStockPerms, getClinicStaff, requireClinicStockPerm } from "@/lib/platform-access";
import { writeAudit } from "@/lib/platform-store";
import {
  addCatalogItem,
  adjustStock,
  confirmInventory,
  createPurchaseRequest,
  decidePurchaseRequest,
  extraCatalog,
  getRequest,
  getStockSettings,
  listInventories,
  listMoves,
  listPriceHistory,
  listSuppliers,
  priceSummary,
  receiveStock,
  saveStockSettings,
  stockAlerts,
  stockDashboard,
  stockOut,
  supplierHistory,
  transferStock,
  upsertStockProduct,
  upsertSupplier,
} from "@/lib/clinic-stock-store";
import {
  STOCK_ADJUST_REASON_LABEL,
  STOCK_CATEGORY_LABEL,
  STOCK_CATEGORY_PRESETS,
  STOCK_OUT_REASON_LABEL,
  STOCK_REQUEST_PRIORITY_LABEL,
  STOCK_REQUEST_STATUS_LABEL,
  STOCK_STATUS_LABEL,
  STOCK_UNIT_LABEL,
  STOCK_UNIT_PRESETS,
} from "@/lib/clinic-stock-labels";
import { CASH_ORIGIN_LABEL, EXPENSE_METHOD_LABEL } from "@/lib/clinic-cash-labels";
import { CLINIC_CASH_ORIGINS, CLINIC_EXPENSE_METHODS, type ClinicCashOrigin, type ClinicExpenseMethod } from "@/lib/platform-types";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"]);

async function fileFromForm(form: FormData, key: string) {
  const f = form.get(key);
  if (!f || typeof f === "string") return null;
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Arquivo maior que 8 MB.");
  const type = f.type || "application/octet-stream";
  if (buf.length && !ALLOWED.has(type) && !f.name.toLowerCase().match(/\.(jpe?g|png|webp|pdf)$/)) {
    throw new Error("Envie foto (JPG/PNG) ou PDF.");
  }
  return { name: f.name, type, buffer: buf };
}

function actorOf(staff: { kind: string; actorId: string; name: string; email: string | null }) {
  return { kind: staff.kind, id: staff.actorId, name: staff.name, email: staff.email };
}

function hideCosts<T extends { avgCostCents?: number }>(items: T[], show: boolean): T[] {
  if (show) return items;
  return items.map((p) => ({ ...p, avgCostCents: 0 }));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicStockPerm(id, "stock_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão para ver o estoque." }, { status: 403 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "dashboard";
  const showCosts = clinicStockPerm(staff, "stock_manage") || staff.canAdmin;
  if (view === "alerts") {
    return NextResponse.json({ alerts: await stockAlerts(id) });
  }
  const [dash, catalog, suppliers, moves, inventories, alerts] = await Promise.all([
    stockDashboard(id),
    extraCatalog(id),
    listSuppliers(id, staff.canAdmin),
    listMoves(id),
    listInventories(id),
    stockAlerts(id),
  ]);
  const productId = url.searchParams.get("productId");
  const supplierId = url.searchParams.get("supplierId");
  const prices = productId ? await listPriceHistory(id, productId) : [];
  const supplierHist = supplierId ? await supplierHistory(id, supplierId) : null;
  const categories = [
    ...STOCK_CATEGORY_PRESETS.map((k) => ({ key: k, label: STOCK_CATEGORY_LABEL[k] })),
    ...catalog.categories.map((c) => ({ key: c.key, label: c.label })),
  ];
  const units = [
    ...STOCK_UNIT_PRESETS.map((k) => ({ key: k, label: STOCK_UNIT_LABEL[k] })),
    ...catalog.units.map((u) => ({ key: u.key, label: u.label })),
  ];
  return NextResponse.json({
    clinic: { id: staff.clinic.id, name: staff.clinic.name },
    staff: { name: staff.name, canAdmin: staff.canAdmin, perms: clinicStockPerms(staff) },
    settings: dash.settings,
    counts: showCosts ? dash.counts : { ...dash.counts, monthSpentCents: 0 },
    attention: hideCosts(dash.attention, showCosts),
    products: hideCosts(dash.products, showCosts),
    requests: dash.requests,
    alerts,
    suppliers,
    moves: moves.slice(0, 80),
    inventories: inventories.slice(0, 20),
    cashAvailableCents: dash.cashAvailableCents,
    catalog: { categories, units },
    prices,
    priceSummary: priceSummary(prices),
    supplierHistory: supplierHist,
    labels: {
      status: STOCK_STATUS_LABEL,
      category: Object.fromEntries(categories.map((c) => [c.key, c.label])),
      unit: Object.fromEntries(units.map((u) => [u.key, u.label])),
      outReason: STOCK_OUT_REASON_LABEL,
      adjustReason: STOCK_ADJUST_REASON_LABEL,
      requestPriority: STOCK_REQUEST_PRIORITY_LABEL,
      requestStatus: STOCK_REQUEST_STATUS_LABEL,
      method: EXPENSE_METHOD_LABEL,
      origin: CASH_ORIGIN_LABEL,
    },
    methods: CLINIC_EXPENSE_METHODS,
    origins: CLINIC_CASH_ORIGINS,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getClinicStaff(id);
  if (!staff || !clinicStockPerm(staff, "stock_view")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  try {
    const ct = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    let attachment: { name: string; type?: string; buffer: Buffer } | null = null;
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") body[k] = v;
      }
      attachment = await fileFromForm(form, "attachment");
    } else {
      body = (await req.json().catch(() => ({}))) as Record<string, string>;
    }
    const action = String(body.action || "");
    const actor = actorOf(staff);

    if (action === "product") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão para cadastrar produto." }, { status: 403 });
      const product = await upsertStockProduct({
        id: body.id || undefined,
        clinicId: id,
        name: String(body.name || ""),
        category: String(body.category || "outros"),
        unit: String(body.unit || "unidade"),
        qty: body.qty != null ? Number(body.qty) : undefined,
        minQty: Number(body.minQty || 0),
        idealQty: Number(body.idealQty || 0),
        location: body.location || null,
        preferredSupplierId: body.preferredSupplierId || null,
        notes: body.notes || null,
        active: body.active == null ? undefined : body.active !== "false" && body.active !== "0",
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: body.id ? "stock_product_update" : "stock_product_create",
        entity: "clinic_stock_product",
        entityId: product.id,
        detail: `${staff.clinic.name} · ${product.name}`,
      });
      return NextResponse.json({ product }, { status: body.id ? 200 : 201 });
    }

    if (action === "supplier") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão para cadastrar fornecedor." }, { status: 403 });
      const supplier = await upsertSupplier({
        id: body.id || undefined,
        clinicId: id,
        name: String(body.name || ""),
        document: body.document || null,
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
        email: body.email || null,
        address: body.address || null,
        productsNote: body.productsNote || null,
        notes: body.notes || null,
        active: body.active == null ? undefined : body.active !== "false" && body.active !== "0",
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: body.id ? "stock_supplier_update" : "stock_supplier_create",
        entity: "clinic_stock_supplier",
        entityId: supplier.id,
        detail: `${staff.clinic.name} · ${supplier.name}`,
      });
      return NextResponse.json({ supplier }, { status: body.id ? 200 : 201 });
    }

    if (action === "settings") {
      if (!staff.canAdmin) return NextResponse.json({ error: "Só a gestora altera a configuração do estoque." }, { status: 403 });
      const days = String(body.expiryAlertDays || "90,60,30")
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const settings = await saveStockSettings(id, {
        requireApproval: body.requireApproval !== "false" && body.requireApproval !== "0",
        expiryAlertDays: days.length ? days : [90, 60, 30],
      });
      return NextResponse.json({ settings });
    }

    if (action === "catalog") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      const item = await addCatalogItem(id, body.kind === "unit" ? "unit" : "category", String(body.label || ""));
      return NextResponse.json({ item }, { status: 201 });
    }

    if (action === "entrada") {
      if (!clinicStockPerm(staff, "stock_in")) return NextResponse.json({ error: "Sem permissão para registrar entrada." }, { status: 403 });
      const settings = await getStockSettings(id);
      const fromCash = body.fromCash === "true" || body.fromCash === "1";
      const createExp = fromCash || body.createExpense === "true" || body.createExpense === "1";
      if (settings.requireApproval && !staff.canAdmin && !clinicStockPerm(staff, "stock_manage")) {
        const requestId = String(body.requestId || "");
        if (!requestId) return NextResponse.json({ error: "Esta clínica exige aprovação. Solicite a compra primeiro." }, { status: 400 });
        const reqRow = await getRequest(requestId);
        if (!reqRow || reqRow.status !== "aprovado") {
          return NextResponse.json({ error: "Aguarde a gestora aprovar a solicitação." }, { status: 400 });
        }
      }
      const total = Math.round(Number(String(body.total ?? body.totalCents ?? "0").replace(",", ".")) * (body.total != null ? 100 : 1));
      const result = await receiveStock({
        clinicId: id,
        clinicName: staff.clinic.name,
        productId: String(body.productId || ""),
        qty: Number(body.qty || 0),
        occurredAt: body.occurredAt || undefined,
        supplierId: body.supplierId || null,
        supplierName: body.supplierName || null,
        totalCents: Number.isFinite(total) ? total : 0,
        method: (body.method as ClinicExpenseMethod) || "dinheiro",
        origin: (body.origin as ClinicCashOrigin) || (fromCash ? "caixa_fisico" : "conta_clinica"),
        createExpense: createExp,
        fromCash,
        confirmCash: body.confirmCash === "true" || body.confirmCash === "1",
        invoiceNumber: body.invoiceNumber || null,
        notes: body.notes || null,
        lotCode: body.lotCode || null,
        manufacturedAt: body.manufacturedAt || null,
        expiresAt: body.expiresAt || null,
        requestId: body.requestId || null,
        attachment,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_in",
        entity: "clinic_stock_move",
        entityId: result.move.id,
        detail: `${staff.clinic.name} · ${result.product.name} · ${result.move.qtyBefore} → ${result.move.qtyAfter}${result.expenseId ? ` · despesa ${result.expenseId}` : ""}`,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "saida") {
      if (!clinicStockPerm(staff, "stock_out")) return NextResponse.json({ error: "Sem permissão para registrar saída." }, { status: 403 });
      const result = await stockOut({
        clinicId: id,
        productId: String(body.productId || ""),
        qty: Number(body.qty || 0),
        reason: String(body.reason || "uso_clinica"),
        notes: body.notes || null,
        occurredAt: body.occurredAt || undefined,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_out",
        entity: "clinic_stock_move",
        entityId: result.move.id,
        detail: `${staff.clinic.name} · ${result.product.name} · ${result.move.qtyBefore} → ${result.move.qtyAfter} · ${body.reason}`,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "ajuste") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão para ajustar estoque." }, { status: 403 });
      const result = await adjustStock({
        clinicId: id,
        productId: String(body.productId || ""),
        countedQty: Number(body.countedQty || 0),
        reason: String(body.reason || ""),
        notes: body.notes || null,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_adjust",
        entity: "clinic_stock_move",
        entityId: result.move.id,
        detail: `${staff.clinic.name} · diferença ${result.difference} · ${body.reason}`,
      });
      return NextResponse.json(result);
    }

    if (action === "transfer") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão para transferir estoque." }, { status: 403 });
      const toClinicId = String(body.toClinicId || "");
      const destStaff = await getClinicStaff(toClinicId);
      if (!destStaff || (!destStaff.canAdmin && !destStaff.isSuperAdmin && !clinicStockPerm(destStaff, "stock_manage"))) {
        return NextResponse.json({ error: "Sem acesso à clínica de destino." }, { status: 403 });
      }
      const result = await transferStock({
        fromClinicId: id,
        toClinicId,
        productId: String(body.productId || ""),
        qty: Number(body.qty || 0),
        notes: body.notes || null,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_transfer",
        entity: "clinic_stock_product",
        entityId: result.from.id,
        detail: `${staff.clinic.name} → ${toClinicId} · ${result.from.name} · ${body.qty}`,
      });
      return NextResponse.json(result);
    }

    if (action === "request") {
      if (!clinicStockPerm(staff, "stock_request")) return NextResponse.json({ error: "Sem permissão para solicitar compra." }, { status: 403 });
      const row = await createPurchaseRequest({
        clinicId: id,
        productId: String(body.productId || ""),
        qty: Number(body.qty || 0),
        priority: (body.priority as "normal" | "urgente" | "critica") || "normal",
        reason: body.reason || null,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_request",
        entity: "clinic_stock_request",
        entityId: row.id,
        detail: `${staff.clinic.name} · ${row.qty} · ${row.priority}`,
      });
      return NextResponse.json({ request: row }, { status: 201 });
    }

    if (action === "decide") {
      if (!staff.canAdmin && !clinicStockPerm(staff, "stock_manage")) {
        return NextResponse.json({ error: "Só a gestora aprova ou rejeita compras." }, { status: 403 });
      }
      const row = await decidePurchaseRequest({
        clinicId: id,
        requestId: String(body.requestId || ""),
        action: body.decision === "reject" ? "reject" : "approve",
        note: body.note || null,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: body.decision === "reject" ? "stock_request_reject" : "stock_request_approve",
        entity: "clinic_stock_request",
        entityId: row.id,
        detail: `${staff.clinic.name} · ${row.status}`,
      });
      return NextResponse.json({ request: row });
    }

    if (action === "inventory") {
      if (!clinicStockPerm(staff, "stock_manage")) return NextResponse.json({ error: "Sem permissão para inventário." }, { status: 403 });
      const rawLines = typeof body.lines === "string" ? JSON.parse(body.lines || "[]") : body.lines;
      const lines = Array.isArray(rawLines) ? rawLines : [];
      const inv = await confirmInventory({
        clinicId: id,
        lines: lines.map((l: { productId?: string; countedQty?: number; reason?: string }) => ({
          productId: String(l.productId || ""),
          countedQty: Number(l.countedQty || 0),
          reason: l.reason || null,
        })),
        justification: body.justification || null,
        actor,
      });
      await writeAudit({
        actorKind: staff.kind,
        actorId: staff.actorId,
        actorEmail: staff.email,
        action: "stock_inventory",
        entity: "clinic_stock_inventory",
        entityId: inv.id,
        detail: `${staff.clinic.name} · ${inv.lines.length} itens`,
      });
      return NextResponse.json({ inventory: inv }, { status: 201 });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir." }, { status: 400 });
  }
}
