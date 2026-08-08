import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  createCoupon,
  deleteCoupon,
  getCouponByCode,
  listCouponsByDoctor,
  logPlansAudit,
} from "@/lib/plans-store";
import type { DiscountType, PromotionScope } from "@/lib/plans";

const VALID_SCOPE: PromotionScope[] = ["consulta", "all_plans", "consulta_plans", "selected_plans"];
const VALID_DISCOUNT: DiscountType[] = ["percent", "fixed", "promo_price"];

function isoOrUndef(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const coupons = await listCouponsByDoctor(doctorId);
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || "").trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,24}$/.test(code)) {
    return NextResponse.json({ error: "Código inválido (use 3–24 letras/números)." }, { status: 400 });
  }
  const existing = await getCouponByCode(doctorId, code);
  if (existing) return NextResponse.json({ error: "Já existe um cupom com esse código." }, { status: 409 });

  const discountType = VALID_DISCOUNT.includes(b.discountType) ? b.discountType : "percent";
  const coupon = await createCoupon({
    doctorId,
    code,
    discountType,
    discountValue: Math.max(0, Math.round(Number(b.discountValue) || 0)),
    scope: VALID_SCOPE.includes(b.scope) ? b.scope : "all_plans",
    planIds: Array.isArray(b.planIds) ? b.planIds.map(String) : [],
    startAt: isoOrUndef(b.startAt),
    endAt: isoOrUndef(b.endAt),
    maxRedemptions:
      b.maxRedemptions === undefined || b.maxRedemptions === null || b.maxRedemptions === ""
        ? undefined
        : Math.max(1, Math.round(Number(b.maxRedemptions))),
    perPatientOnce: b.perPatientOnce === undefined ? true : Boolean(b.perPatientOnce),
    newPatientsOnly: Boolean(b.newPatientsOnly),
    active: b.active === undefined ? true : Boolean(b.active),
  });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "coupon.create", entity: "coupon", entityId: coupon.id, detail: { code, discountType } });
  return NextResponse.json({ ok: true, coupon }, { status: 201 });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const ok = await deleteCoupon(id, doctorId);
  if (!ok) return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "coupon.delete", entity: "coupon", entityId: id });
  return NextResponse.json({ ok: true });
}
