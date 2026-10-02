import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getBookingById, getDoctorById, readDb } from "@/lib/store";
import {
  confirmBookingPaid,
  createCheckoutPreference,
  createMercadoPagoPixPayment,
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

  // QR Code Pix — caminho padrão. A tela amarela do Checkout Pro (saldo, cartão,
  // boleto) trava o botão Pagar. Só abrimos ela se o cliente pedir (preferMp).
  if (booking.status === "pending_payment" && !body.preferMp) {
    const pix = await pixPayload(bookingId);
    if (pix) return NextResponse.json(pix);

    if (isMercadoPagoEnabledFor(doctor)) {
      try {
        const mpPix = await createMercadoPagoPixPayment(booking, doctor);
        if (mpPix) {
          const qrDataUrl =
            mpPix.qrDataUrl ||
            (await QRCode.toDataURL(mpPix.brCode, { width: 280, margin: 1, errorCorrectionLevel: "M" }));
          return NextResponse.json({
            provider: "pix",
            bookingId: booking.id,
            brCode: mpPix.brCode,
            qrDataUrl,
            amountCents: booking.priceCents,
            holderName: doctor.name,
            doctorName: doctor.name,
            via: "mercadopago_pix",
          });
        }
      } catch {
        /* cai no Checkout Pro só se preferMp, senão erro honesto */
      }
    }
  }

  // Checkout Pro só quando pedido explicitamente (cartão / saldo Mercado Livre).
  if (body.preferMp && isMercadoPagoEnabledFor(doctor) && booking.status === "pending_payment") {
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

  if (isMercadoPagoEnabledFor(doctor) && booking.status === "pending_payment") {
    return NextResponse.json(
      { error: "Não foi possível gerar o QR Code Pix. Cadastre a chave Pix do médico nas configurações." },
      { status: 502 }
    );
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
