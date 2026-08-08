import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  createPromotion,
  deletePromotion,
  listPromotionsByDoctor,
  logPlansAudit,
  updatePromotion,
} from "@/lib/plans-store";
import { effectivePromotionStatus, type DiscountType, type PromotionScope, type PromotionStatus } from "@/lib/plans";

const VALID_SCOPE: PromotionScope[] = ["consulta", "all_plans", "consulta_plans", "selected_plans"];
const VALID_DISCOUNT: DiscountType[] = ["percent", "fixed", "promo_price"];
const VALID_STATUS: PromotionStatus[] = ["ativa", "pausada", "encerrada"];

function isoOrUndef(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const promotions = (await listPromotionsByDoctor(doctorId)).map((p) => ({
    ...p,
    effectiveStatus: effectivePromotionStatus(p),
  }));
  return NextResponse.json({ promotions });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Informe o nome da promoção." }, { status: 400 });
  const scope = VALID_SCOPE.includes(b.scope) ? b.scope : "all_plans";
  const discountType = VALID_DISCOUNT.includes(b.discountType) ? b.discountType : "percent";
  const promo = await createPromotion({
    doctorId,
    name,
    description: b.description ? String(b.description) : undefined,
    scope,
    planIds: Array.isArray(b.planIds) ? b.planIds.map(String) : [],
    discountType,
    discountValue: Math.max(0, Math.round(Number(b.discountValue) || 0)),
    startAt: isoOrUndef(b.startAt),
    endAt: isoOrUndef(b.endAt),
    status: VALID_STATUS.includes(b.status) ? b.status : "ativa",
  });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "promotion.create", entity: "promotion", entityId: promo.id, detail: { name, discountType, discountValue: promo.discountValue } });
  return NextResponse.json({ ok: true, promotion: promo }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = String(b.name).trim();
  if (b.description !== undefined) patch.description = b.description ? String(b.description) : undefined;
  if (b.scope !== undefined && VALID_SCOPE.includes(b.scope)) patch.scope = b.scope;
  if (b.planIds !== undefined) patch.planIds = Array.isArray(b.planIds) ? b.planIds.map(String) : [];
  if (b.discountType !== undefined && VALID_DISCOUNT.includes(b.discountType)) patch.discountType = b.discountType;
  if (b.discountValue !== undefined) patch.discountValue = Math.max(0, Math.round(Number(b.discountValue) || 0));
  if (b.startAt !== undefined) patch.startAt = isoOrUndef(b.startAt);
  if (b.endAt !== undefined) patch.endAt = isoOrUndef(b.endAt);
  if (b.status !== undefined && VALID_STATUS.includes(b.status)) patch.status = b.status;
  const updated = await updatePromotion(id, doctorId, patch);
  if (!updated) return NextResponse.json({ error: "Promoção não encontrada." }, { status: 404 });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "promotion.update", entity: "promotion", entityId: id, detail: patch });
  return NextResponse.json({ ok: true, promotion: { ...updated, effectiveStatus: effectivePromotionStatus(updated) } });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const ok = await deletePromotion(id, doctorId);
  if (!ok) return NextResponse.json({ error: "Promoção não encontrada." }, { status: 404 });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "promotion.delete", entity: "promotion", entityId: id });
  return NextResponse.json({ ok: true });
}
