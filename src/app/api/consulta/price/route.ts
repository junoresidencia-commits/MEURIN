import { NextResponse } from "next/server";
import { buildServicePricing } from "@/lib/plan-billing";

/**
 * Prévia pública do preço da CONSULTA avulsa (aplica promoção vigente e/ou cupom).
 * O agendamento é público, então o cupom é avaliado por e-mail do paciente.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const doctorId = String(b.doctorId || "");
  const email = String(b.email || "").toLowerCase().trim();
  if (!doctorId) return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });

  const result = await buildServicePricing({
    doctorId,
    serviceType: "consulta",
    couponCode: b.couponCode ? String(b.couponCode) : undefined,
    patientKey: email || "anon",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ pricing: result.snapshot });
}
