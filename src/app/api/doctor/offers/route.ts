import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { createOffer, listOffersByDoctor, logPlansAudit } from "@/lib/plans-store";
import {
  buildPricingSnapshot,
  type DiscountType,
  type PlanDurationKind,
  type ServiceType,
} from "@/lib/plans";
import { resolveServiceSharePercent } from "@/lib/types";

const VALID_DISCOUNT: DiscountType[] = ["percent", "fixed", "promo_price"];
const VALID_DURATION: PlanDurationKind[] = ["30d", "3m", "6m", "12m", "custom"];

function isoOrUndef(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const offers = await listOffersByDoctor(doctorId);
  return NextResponse.json({ offers });
}

/** Cria uma proposta personalizada (condição especial ou plano) para um paciente. */
export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const patientKey = String(b.patientKey || "").trim();
  const patientName = String(b.patientName || "").trim();
  const offerType: ServiceType = b.offerType === "consulta" ? "consulta" : "plan";
  const planName = String(b.planName || (offerType === "consulta" ? "Consulta" : "Plano personalizado")).trim();
  if (!patientKey || !patientName) {
    return NextResponse.json({ error: "Paciente inválido." }, { status: 400 });
  }

  const originalPriceCents = Math.max(0, Math.round(Number(b.originalPriceCents) || 0));
  const discountType: DiscountType | null =
    b.discountType && VALID_DISCOUNT.includes(b.discountType) ? b.discountType : null;
  const discountValue = discountType ? Math.max(0, Math.round(Number(b.discountValue) || 0)) : null;

  // Recalcula o preço final no backend (não confia no valor do frontend).
  const doctorPercent = resolveServiceSharePercent(doctor, offerType);
  const snapshot = buildPricingSnapshot({
    serviceType: offerType,
    originalPriceCents,
    discountType,
    discountValue,
    doctorPercent,
    appliedLabel: "Condição especial",
  });

  const offer = await createOffer({
    doctorId,
    doctorName: doctor.name,
    patientKey,
    patientName,
    offerType,
    planName,
    description: b.description ? String(b.description) : undefined,
    durationKind: offerType === "plan" && VALID_DURATION.includes(b.durationKind) ? b.durationKind : undefined,
    customDays: b.customDays == null ? undefined : Math.max(1, Math.round(Number(b.customDays))),
    consultations: b.consultations == null ? undefined : Math.max(1, Math.round(Number(b.consultations))),
    originalPriceCents,
    discountType,
    discountValue,
    finalPriceCents: snapshot.finalPriceCents,
    validUntil: isoOrUndef(b.validUntil),
    status: "enviada",
  });
  await logPlansAudit({ actor: "medico", actorId: doctorId, doctorId, action: "offer.create", entity: "patient_offer", entityId: offer.id, detail: { patientKey, finalPriceCents: snapshot.finalPriceCents } });
  return NextResponse.json({ ok: true, offer }, { status: 201 });
}
