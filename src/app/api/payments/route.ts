import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import {
  confirmBookingPaid,
  createCheckoutPreference,
  isMercadoPagoEnabledFor,
} from "@/lib/payments";
import { buildConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { bookingId, mode } = await req.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId obrigatório" }, { status: 400 });
  }

  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  const doctor = db.doctors.find((d) => d.id === booking.doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  }

  // PIX direto: o paciente escolheu pagar direto ao médico. NÃO confirma aqui —
  // o paciente envia o comprovante e o médico confirma manualmente. (Coexiste com o MP.)
  if (mode === "pix_direto") {
    if (!doctor.pixAccept || !doctor.pixKey?.trim()) {
      return NextResponse.json({ error: "Este médico não recebe por PIX direto." }, { status: 400 });
    }
    return NextResponse.json({ provider: "pix_direto", bookingId });
  }

  // Pagamento real (Mercado Pago): cria a preferência e devolve a URL de checkout.
  // A confirmação acontece só pelo webhook (não confiamos no retorno do navegador).
  if (isMercadoPagoEnabledFor(doctor) && booking.status === "pending_payment") {
    try {
      const { redirectUrl } = await createCheckoutPreference(booking, doctor);
      return NextResponse.json({ provider: "mercadopago", redirectUrl });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Falha no pagamento" },
        { status: 502 }
      );
    }
  }

  // Modo demonstração: confirma na hora (pagamento simulado).
  const confirmed = await confirmBookingPaid(bookingId);
  if (!confirmed) {
    return NextResponse.json({ error: "Não foi possível confirmar." }, { status: 500 });
  }

  const payment = (await readDb()).payments.find((p) => p.bookingId === bookingId);
  const email = buildConfirmationEmail(confirmed.booking, doctor, confirmed.meetingUrl);

  return NextResponse.json({
    provider: "simulado",
    booking: confirmed.booking,
    payment,
    meetingUrl: confirmed.meetingUrl,
    email,
  });
}
