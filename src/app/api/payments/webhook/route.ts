import { NextResponse } from "next/server";
import { confirmBookingPaid, fetchMercadoPagoPayment } from "@/lib/payments";

/**
 * Webhook do Mercado Pago. Não confiamos no retorno do navegador: a consulta
 * só é liberada quando o Mercado Pago confirma o pagamento como "approved".
 */
export async function POST(req: Request) {
  const url = new URL(req.url);

  // A notificação pode vir por querystring (?type=payment&data.id=123) ou no corpo.
  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";

  try {
    const body = await req.json();
    type = type || body?.type || body?.action || "";
    paymentId = paymentId || body?.data?.id || body?.id || "";
  } catch {
    /* corpo vazio — usa os parâmetros da querystring */
  }

  // Só tratamos notificações de pagamento.
  if (paymentId && (type.includes("payment") || type === "")) {
    const payment = await fetchMercadoPagoPayment(String(paymentId));
    if (payment && payment.status === "approved" && payment.external_reference) {
      await confirmBookingPaid(payment.external_reference);
    }
  }

  // Sempre 200 para o Mercado Pago não reenviar indefinidamente.
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
