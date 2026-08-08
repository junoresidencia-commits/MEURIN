import "server-only";

import { v4 as uuid } from "uuid";
import { updateDb } from "./store";
import { buildConfirmationEmail, sendEmail } from "./email";
import type { Booking, Doctor } from "./types";

const MP_API = "https://api.mercadopago.com";

/** Token da plataforma (conta do dono), usado como fallback. */
export function getMercadoPagoToken(): string | null {
  return process.env.MERCADOPAGO_ACCESS_TOKEN || null;
}

/** Token que deve receber o pagamento desta consulta: o do médico, se conectado; senão o da plataforma. */
export function getCollectorToken(doctor?: { mpAccessToken?: string } | null): string | null {
  const own = doctor?.mpAccessToken?.trim();
  return own || getMercadoPagoToken();
}

export function isMercadoPagoEnabled(): boolean {
  return Boolean(getMercadoPagoToken());
}

/** Há como cobrar de verdade esta consulta? (conta do médico OU da plataforma) */
export function isMercadoPagoEnabledFor(doctor?: { mpAccessToken?: string } | null): boolean {
  return Boolean(getCollectorToken(doctor));
}

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Cria uma preferência do Checkout Pro para a consulta e devolve a URL de
 * pagamento (init_point). O token de teste ("TEST-...") usa o sandbox.
 */
export async function createCheckoutPreference(
  booking: Booking,
  doctor: Pick<Doctor, "id" | "name" | "mpAccessToken">
): Promise<{ redirectUrl: string; preferenceId: string }> {
  const token = getCollectorToken(doctor);
  if (!token) throw new Error("Mercado Pago não configurado.");
  const doctorName = doctor.name;

  const origin = appOrigin();
  const body = {
    items: [
      {
        id: booking.id,
        title: `Consulta Meu Rim — ${doctorName}`,
        description: "Teleconsulta de nefrologia",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Math.round(booking.priceCents) / 100,
      },
    ],
    payer: { name: booking.patientName, email: booking.patientEmail },
    external_reference: booking.id,
    back_urls: {
      success: `${origin}/confirmacao/${booking.id}`,
      pending: `${origin}/confirmacao/${booking.id}`,
      failure: `${origin}/confirmacao/${booking.id}`,
    },
    auto_return: "approved",
    // O ?doctor= diz ao webhook qual conta (token) usar para confirmar o pagamento.
    notification_url: `${origin}/api/payments/webhook?doctor=${doctor.id}`,
    metadata: { booking_id: booking.id, doctor_id: doctor.id },
    statement_descriptor: "MEU RIM",
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Falha ao criar preferência Mercado Pago: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  };

  const isTest = token.startsWith("TEST-");
  const redirectUrl = (isTest ? data.sandbox_init_point : data.init_point) || data.init_point;
  if (!redirectUrl) throw new Error("Preferência sem URL de pagamento.");
  return { redirectUrl, preferenceId: data.id };
}

type MpPayment = {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
};

export async function fetchMercadoPagoPayment(
  paymentId: string,
  token?: string | null
): Promise<MpPayment | null> {
  const useToken = token || getMercadoPagoToken();
  if (!useToken) return null;
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${useToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

/**
 * Marca a consulta como paga/confirmada, registra o pagamento, bloqueia o
 * horário e envia o e-mail de confirmação. Idempotente.
 */
export async function confirmBookingPaid(
  bookingId: string
): Promise<{ booking: Booking; meetingUrl: string } | null> {
  let meetingUrl = "";
  let emailToSend: { to: string; subject: string; body: string } | null = null;

  const result = await updateDb((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) return db;
    if (booking.status === "confirmed" || booking.status === "paid") {
      // Já confirmado — apenas recompõe a URL da sala, sem duplicar pagamento/e-mail.
      meetingUrl = `${appOrigin()}/consulta/${booking.meetingRoomId}`;
      return db;
    }

    const doctor = db.doctors.find((d) => d.id === booking.doctorId);
    if (!doctor) return db;

    // Se o médico recebeu na própria conta, o valor integral é dele (sem taxa retida
    // pela plataforma). Só há repasse/desconto quando a cobrança foi na conta da plataforma.
    const collectedByDoctor = Boolean(doctor.mpAccessToken?.trim());
    const platformFeeCents = collectedByDoctor ? 0 : Math.round(booking.priceCents * 0.05);
    const doctorPayoutCents = booking.priceCents - platformFeeCents;
    const paymentId = uuid();
    const paidAt = new Date().toISOString();

    const updatedBooking: Booking = {
      ...booking,
      status: "confirmed",
      paymentId,
      paidAt,
      confirmationEmailSent: true,
    };

    meetingUrl = `${appOrigin()}/consulta/${updatedBooking.meetingRoomId}`;
    emailToSend = buildConfirmationEmail(updatedBooking, doctor, meetingUrl);

    return {
      ...db,
      bookings: db.bookings.map((b) => (b.id === bookingId ? updatedBooking : b)),
      payments: [
        ...db.payments,
        {
          id: paymentId,
          bookingId: booking.id,
          doctorId: doctor.id,
          amountCents: booking.priceCents,
          method: booking.paymentMethod,
          status: "succeeded" as const,
          doctorPayoutCents,
          platformFeeCents,
          createdAt: paidAt,
        },
      ],
      doctors: db.doctors.map((d) =>
        d.id === doctor.id
          ? { ...d, blockedSlots: [...d.blockedSlots, booking.slotStart] }
          : d
      ),
    };
  });

  const booking = result.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  if (emailToSend) {
    await sendEmail(emailToSend);
  }

  return { booking, meetingUrl };
}
