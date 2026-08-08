import { NextResponse } from "next/server";
import { fetchMercadoPagoPayment, getCollectorToken } from "@/lib/payments";
import { getDoctorById } from "@/lib/store";
import { activateEnrollment } from "@/lib/plan-billing";

/**
 * Webhook do Mercado Pago para PLANOS. A contratação só é ativada quando o
 * pagamento é confirmado como "approved". Idempotente (activateEnrollment).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  try {
    const body = await req.json();
    type = type || body?.type || body?.action || "";
    paymentId = paymentId || body?.data?.id || body?.id || "";
  } catch {
    /* querystring apenas */
  }

  const doctorId = url.searchParams.get("doctor") || "";
  const doctor = doctorId ? await getDoctorById(doctorId) : null;
  const token = getCollectorToken(doctor);

  if (paymentId && (type.includes("payment") || type === "")) {
    const payment = await fetchMercadoPagoPayment(String(paymentId), token);
    if (payment && payment.status === "approved" && payment.external_reference) {
      await activateEnrollment(payment.external_reference, { paymentId: String(paymentId), by: "webhook" });
    }
  }
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
