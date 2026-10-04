import "server-only";

import { v4 as uuid } from "uuid";
import { updateDb } from "./store";
import { sendEmail } from "./email";
import { sendNotification, patientKey, links, fmtDateTime, firstName } from "./notify";
import { notifyDoctorOnPayment } from "./whatsapp-payment";
import { computeSplit, doctorFeeRule, resolveDoctorSharePercent } from "./types";
import type { Booking, Doctor } from "./types";
import { recordPlatformCharge } from "./platform-charges-store";

const MP_API = "https://api.mercadopago.com";

/** Token da plataforma (conta do dono), usado como fallback. */
export function getMercadoPagoToken(): string | null {
  return process.env.MERCADOPAGO_ACCESS_TOKEN || null;
}

/**
 * Token que deve receber o pagamento desta consulta: o do médico, se conectado E
 * com recebimento liberado pelo administrador; senão, o da plataforma.
 */
export function getCollectorToken(
  doctor?: { mpAccessToken?: string; payoutStatus?: string } | null
): string | null {
  const own = doctor?.mpAccessToken?.trim();
  const released = (doctor?.payoutStatus ?? "active") === "active";
  if (own && released) return own;
  return getMercadoPagoToken();
}

export function isMercadoPagoEnabled(): boolean {
  return Boolean(getMercadoPagoToken());
}

/** Há como cobrar de verdade esta consulta? (conta do médico OU da plataforma) */
export function isMercadoPagoEnabledFor(doctor?: { mpAccessToken?: string } | null): boolean {
  return Boolean(getCollectorToken(doctor));
}

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
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
  const method = booking.paymentMethod;
  // Não excluir meios: cartão, saldo Mercado Livre e boleto precisam continuar
  // disponíveis no Checkout Pro. Só sugerimos o tipo escolhido no agendamento.
  const paymentMethods: Record<string, unknown> = {
    installments: 12,
    default_installments: 1,
  };
  if (method === "boleto") paymentMethods.default_payment_type_id = "ticket";
  if (method === "card") paymentMethods.default_payment_type_id = "credit_card";
  if (method === "pix") paymentMethods.default_payment_type_id = "bank_transfer";

  const digits = (booking.patientPhone || "").replace(/\D/g, "");
  const phone =
    digits.length >= 10
      ? { area_code: digits.slice(0, 2), number: digits.slice(2, 11) }
      : undefined;

  const body: Record<string, unknown> = {
    items: [
      {
        id: booking.id,
        title: `Consulta Meu Rim — ${doctorName}`.slice(0, 60),
        description: "Consulta de nefrologia — Meu Rim",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Math.round(booking.priceCents) / 100,
      },
    ],
    payer: {
      name: booking.patientName,
      email: booking.patientEmail,
      ...(phone ? { phone } : {}),
    },
    external_reference: booking.id,
    back_urls: {
      success: `${origin}/confirmacao/${booking.id}`,
      pending: `${origin}/confirmacao/${booking.id}`,
      failure: `${origin}/confirmacao/${booking.id}`,
    },
    metadata: { booking_id: booking.id, doctor_id: doctor.id },
    statement_descriptor: "MEURIM",
    binary_mode: false,
    payment_methods: paymentMethods,
  };
  // Mercado Pago rejeita notification_url em HTTP; auto_return trava o Pagar no boleto.
  if (origin.startsWith("https://")) {
    body.notification_url = `${origin}/api/payments/webhook?doctor=${doctor.id}`;
  }

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

/**
 * Cobra via Pix da API do Mercado Pago (QR + copia e cola), sem Checkout Pro.
 * Usado quando o médico não cadastrou chave Pix própria.
 * O dinheiro cai na conta MP do coletor (médico conectado ou plataforma).
 */
export async function createMercadoPagoPixPayment(
  booking: Booking,
  doctor: Pick<Doctor, "id" | "name" | "mpAccessToken">
): Promise<{ brCode: string; qrDataUrl?: string; mpPaymentId: string } | null> {
  const token = getCollectorToken(doctor);
  if (!token) return null;

  const origin = appOrigin();
  const firstNamePayer = (booking.patientName || "Paciente").trim().split(/\s+/)[0] || "Paciente";
  const body: Record<string, unknown> = {
    transaction_amount: Math.round(booking.priceCents) / 100,
    description: `Consulta Meu Rim — ${doctor.name}`.slice(0, 60),
    payment_method_id: "pix",
    payer: {
      email: booking.patientEmail,
      first_name: firstNamePayer,
    },
    external_reference: booking.id,
    metadata: { booking_id: booking.id, doctor_id: doctor.id },
  };
  if (origin.startsWith("https://")) {
    body.notification_url = `${origin}/api/payments/webhook?doctor=${doctor.id}`;
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `pix-${booking.id}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    id?: number;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string };
    };
  };
  const tx = data.point_of_interaction?.transaction_data;
  const brCode = (tx?.qr_code || "").trim();
  if (!brCode || !data.id) return null;
  const raw = (tx?.qr_code_base64 || "").replace(/\s/g, "");
  return {
    brCode,
    qrDataUrl: raw ? `data:image/png;base64,${raw}` : undefined,
    mpPaymentId: String(data.id),
  };
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
  const emailsToSend: { to: string; subject: string; body: string }[] = [];

  const result = await updateDb((db) => {
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) return db;
    if (booking.status === "confirmed" || booking.status === "paid") {
      // Já processado — apenas recompõe a URL da sala, sem duplicar pagamento/e-mail.
      meetingUrl = `${appOrigin()}/consulta/${booking.meetingRoomId}`;
      return db;
    }

    const doctor = db.doctors.find((d) => d.id === booking.doctorId);
    if (!doctor) return db;

    // Snapshot imutável: usa o percentual de repasse VIGENTE (definido pelo admin) no
    // momento do pagamento. Alterações futuras de preço/percentual não afetam este registro.
    const doctorSharePercent = resolveDoctorSharePercent(doctor);
    const { doctorPayoutCents, platformFeeCents } = computeSplit(
      booking.priceCents,
      doctorSharePercent
    );
    const paymentId = uuid();
    const paidAt = new Date().toISOString();

    // Pagamento OK, mas a consulta NÃO é confirmada automaticamente: aguarda o médico.
    const events = [
      ...(booking.events ?? []),
      { at: paidAt, actor: "sistema" as const, type: "pagamento", detail: "Pagamento identificado." },
      { at: paidAt, actor: "sistema" as const, type: "aguardando_confirmacao", detail: "Médico notificado. Aguardando confirmação." },
    ];
    const updatedBooking: Booking = {
      ...booking,
      status: "paid",
      stage: "aguardando_confirmacao",
      events,
      paymentId,
      paidAt,
      confirmationEmailSent: false,
    };

    meetingUrl = `${appOrigin()}/consulta/${updatedBooking.meetingRoomId}`;
    if (booking.patientEmail?.includes("@")) {
      emailsToSend.push({
        to: booking.patientEmail,
        subject: "Recebemos sua solicitação de consulta — Meu Rim",
        body: `Recebemos o pagamento da sua consulta com ${doctor.name}. Estamos aguardando a confirmação do horário pelo médico — avisaremos assim que confirmar.`,
      });
    }
    if (doctor.email) {
      emailsToSend.push({
        to: doctor.email,
        subject: `Nova solicitação de consulta — ${booking.patientName}`,
        body: `${booking.patientName} solicitou uma consulta (pagamento identificado). Acesse o Meu Rim para confirmar ou propor outro horário.`,
      });
    }

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
          doctorSharePercent,
          createdAt: paidAt,
        },
      ],
    };
  });

  const booking = result.bookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  const paidDoctor = result.doctors.find((d) => d.id === booking.doctorId);
  if (paidDoctor) {
    await recordPlatformCharge({
      actorKind: "doctor",
      professionalId: paidDoctor.id,
      professionalName: paidDoctor.name,
      kind: "atendimento",
      sourceId: booking.id,
      rule: doctorFeeRule(paidDoctor),
      priceCents: booking.priceCents,
      note: booking.courtesyKind === "retorno" ? "retorno" : "consulta médica",
    }).catch(() => null);
  }

  for (const email of emailsToSend) {
    await sendEmail(email);
  }

  // Notificações (push + central): médico recebe "nova consulta", paciente "recebemos".
  try {
    const doctor = result.doctors.find((d) => d.id === booking.doctorId);
    const quando = fmtDateTime(booking.slotStart, doctor?.tz);
    await sendNotification({
      userId: booking.doctorId,
      role: "medico",
      type: "nova_consulta",
      title: "Nova consulta agendada",
      body: `${firstName(booking.patientName)} agendou uma consulta para ${quando}. Toque para confirmar.`,
      targetUrl: links.doctorConsulta(booking.id),
      tag: `booking-${booking.id}`,
      relatedType: "booking",
      relatedId: booking.id,
    });
    await sendNotification({
      userId: patientKey(booking.patientEmail),
      role: "paciente",
      type: "solicitacao_recebida",
      title: "Recebemos sua solicitação",
      body: `Estamos aguardando a confirmação do médico para ${quando}. Avisaremos aqui.`,
      targetUrl: links.patientConsulta(booking.id),
      tag: `booking-${booking.id}`,
      relatedType: "booking",
      relatedId: booking.id,
    });
    await notifyDoctorOnPayment(doctor, booking).catch(() => {});
  } catch {
    // notificação não deve quebrar o pagamento
  }

  return { booking, meetingUrl };
}
