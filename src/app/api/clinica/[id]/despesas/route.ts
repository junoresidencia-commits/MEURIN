import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import {
  CASH_ORIGIN_LABEL,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_METHOD_LABEL,
  correctExpense,
  createExpense,
  listExpenses,
} from "@/lib/clinic-cash-store";
import { writeAudit } from "@/lib/platform-store";
import {
  CLINIC_CASH_ORIGINS,
  CLINIC_EXPENSE_CATEGORIES,
  CLINIC_EXPENSE_METHODS,
  type ClinicCashOrigin,
  type ClinicExpenseCategory,
  type ClinicExpenseMethod,
} from "@/lib/platform-types";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg", "application/pdf"]);

async function fileFromForm(form: FormData, key: string) {
  const f = form.get(key);
  if (!f || typeof f === "string") return null;
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Comprovante maior que 8 MB.");
  const type = f.type || "application/octet-stream";
  if (buf.length && !ALLOWED.has(type) && !f.name.toLowerCase().match(/\.(jpe?g|png|webp|pdf)$/)) {
    throw new Error("Envie foto (JPG/PNG) ou PDF do comprovante.");
  }
  return { name: f.name, type, buffer: buf };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const expenses = await listExpenses(id, from, to);
  return NextResponse.json({
    expenses,
    labels: {
      category: EXPENSE_CATEGORY_LABEL,
      method: EXPENSE_METHOD_LABEL,
      origin: CASH_ORIGIN_LABEL,
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "expense");
  if (!staff) return NextResponse.json({ error: "Sem permissão para registrar despesa." }, { status: 403 });
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
    const category = String(body.category || "outros") as ClinicExpenseCategory;
    const method = String(body.method || "dinheiro") as ClinicExpenseMethod;
    const origin = String(body.origin || "caixa_fisico") as ClinicCashOrigin;
    if (!CLINIC_EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
    }
    if (!CLINIC_EXPENSE_METHODS.includes(method)) {
      return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });
    }
    if (!CLINIC_CASH_ORIGINS.includes(origin)) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
    }
    const amountCents = Math.round(Number(String(body.amount ?? body.amountCents ?? "0").replace(",", ".")) * (body.amount != null ? 100 : 1));
    const expense = await createExpense({
      clinicId: id,
      occurredAt: body.occurredAt ? String(body.occurredAt) : undefined,
      amountCents: Number.isFinite(amountCents) ? amountCents : 0,
      category,
      description: String(body.description || ""),
      method,
      origin,
      responsibleName: String(body.responsibleName || staff.name),
      locationLabel: body.locationLabel ? String(body.locationLabel) : staff.clinic.name,
      notes: body.notes ? String(body.notes) : null,
      attachment,
      recordedByKind: staff.kind,
      recordedById: staff.actorId,
      recordedByEmail: staff.email,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "clinic_expense",
      entity: "clinic_expense",
      entityId: expense.id,
      detail: `${staff.clinic.name} · ${expense.description} · ${(expense.amountCents / 100).toFixed(2)}`,
    });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível registrar a despesa." }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "expense");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const result = await correctExpense({
      clinicId: id,
      expenseId: String(body.expenseId || ""),
      amountCents: Math.round(Number(body.amount != null ? Number(body.amount) * 100 : body.amountCents || 0)),
      reason: String(body.reason || ""),
      description: body.description ? String(body.description) : undefined,
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "clinic_expense_correction",
      entity: "clinic_expense",
      entityId: result.next.id,
      detail: `${staff.clinic.name} · ${result.previous.amountCents} → ${result.next.amountCents} · ${body.reason}`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Correção não registrada." }, { status: 400 });
  }
}
