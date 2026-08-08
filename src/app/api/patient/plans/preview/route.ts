import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { buildServicePricing } from "@/lib/plan-billing";
import type { ServiceType } from "@/lib/plans";

/** Prévia autoritativa do preço (backend recalcula desconto/cupom). */
export async function POST(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const serviceType: ServiceType = b.serviceType === "consulta" ? "consulta" : "plan";
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });

  const result = await buildServicePricing({
    doctorId,
    serviceType,
    planId: b.planId ? String(b.planId) : undefined,
    couponCode: b.couponCode ? String(b.couponCode) : undefined,
    patientKey: subject,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    pricing: result.snapshot,
    planName: result.planName,
    durationLabel: result.durationLabel,
    consultations: result.consultations,
  });
}
