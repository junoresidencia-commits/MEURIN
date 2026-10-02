import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getBookingById, getDoctorById, readDb } from "@/lib/store";
import {
  confirmBookingPaid,
  createCheckoutPreference,
  isMercadoPagoEnabledFor,
} from "@/lib/payments";
import { buildBookingPix } from "@/lib/pix-brcode";
import { buildConfirmationEmail } from "@/lib/email";
import { trackFunnelEvent } from "@/lib/analytics-store";

async function pixPayload(bookingId: string) {
  const booking = await getBookingById(bookingId);
  if (!booking) return null;
  const doctor = await getDoctorById(booking.doctorId);
  if (!doctor) return null;
  const pix = buildBookingPix(doctor, booking);
  if (!pix) return null;
  const qrDataUrl = await QRCode.toDataURL(pix.brCode, { width: 280, margin: 1, errorCorrectionLevel: "M" });
  return {
    provider: "pix" as const,
    bookingId: booking.id,
    brCode: pix.brCode,
    qrDataUrl,
    amountCents: pix.amountCents,
    holderName: pix.holderName,
    doctorName: doctor.name,
  };
}

export async function GET(req: Request) {
  const bookingId = new URL(req.url).searchParams.get("bookingId") || "";
  if (!bookingId) return NextResponse.json({ error: "bookingId obrigatório" }, { status: 400 });
  const pix = await pixPayload(bookingId);
  if (!pix) return NextResponse.json({ provider: null });
  return NextResponse.json(pix);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "");
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

  await trackFunnelEvent({
    type: "payment_started",
    doctorId: booking.doctorId,
    bookingId: booking.id,
  });

  // Paciente já pagou o Pix da chave do médico — marcar e avisar o médico.
  if (body.pixDeclared && booking.status === "pending_payment") {
    const confirmed = await confirmBookingPaid(bookingId);
    if (!confirmed) return NextResponse.json({ error: "Não foi possível confirmar." }, { status: 500 });
    await trackFunnelEvent({ type: "payment_completed", doctorId: booking.doctorId, bookingId: booking.id });
    return NextResponse.json({ provider: "pix", booking: confirmed.booking, meetingUrl: confirmed.meetingUrl });
  }

  // Pix direto na chave cadastrada pelo médico (QR Code). Não passa pelo Mercado Pago.
  const wantsPix = booking.paymentMethod === "pix" || body.preferPix;
  if (wantsPix && booking.status === "pending_payment") {
    const pix = await pixPayload(bookingId);
    if (pix) return NextResponse.json(pix);
  }

  // Cartão / boleto (e Pix se o médico não cadastrou chave): Checkout Pro.
  if (isMercadoPagoEnabledFor(doctor) && booking.status === "pending_payment") {
    try {
      const { redirectUrl } = await createCheckoutPreference(booking, doctor);
      return NextResponse.json({ provider: "mercadopago", redirectUrl });
    } catch (error) {
      const pix = await pixPayload(bookingId);
      if (pix) {
        return NextResponse.json({
          ...pix,
          mpError: "O checkout do Mercado Pago não abriu. Pague pelo Pix abaixo.",
        });
      }
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

  await trackFunnelEvent({
    type: "payment_completed",
    doctorId: booking.doctorId,
    bookingId: booking.id,
  });

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
