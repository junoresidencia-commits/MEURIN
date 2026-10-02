import "server-only";

import { siteUrl } from "./site";
import { firstName, fmtDateTime, links } from "./notify";
import {
  getWhatsAppSettings,
  logWhatsAppMessage,
  sendWhatsApp,
  type SendResult,
} from "./whatsapp-store";
import type { Booking, Doctor } from "./types";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** WhatsApp interno do médico (avisos). Nunca o número de contato do paciente. */
export function doctorPaymentAlertPhone(doctor: {
  notifyWhatsapp?: string;
  phone?: string;
} | null | undefined): string | null {
  const raw = (doctor?.notifyWhatsapp || doctor?.phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return raw;
}

export function shouldNotifyDoctorPaymentWhatsApp(
  doctor: { notifyPayments?: boolean } | null | undefined,
  settings: { permMedico?: boolean } | null | undefined
): boolean {
  if (doctor?.notifyPayments === false) return false;
  if (settings && settings.permMedico === false) return false;
  return true;
}

/** Texto do aviso. Sem dado clínico — só nome, horário, valor e link para confirmar. */
export function buildDoctorPaymentWhatsApp(input: {
  patientName: string;
  slotStart: string;
  priceCents: number;
  bookingId: string;
  tz?: string;
}): string {
  const quando = fmtDateTime(input.slotStart, input.tz);
  const abrir = siteUrl(links.doctorConsulta(input.bookingId));
  return [
    "Meu Rim — pagamento identificado.",
    "",
    `Paciente: ${firstName(input.patientName)}`,
    `Horário: ${quando}`,
    `Valor: ${formatBRL(input.priceCents)}`,
    "Confira se caiu na sua chave Pix e confirme o horário.",
    "",
    `Abrir: ${abrir}`,
  ].join("\n");
}

/** Avisa o médico no WhatsApp quando o pagamento da consulta é identificado. Best-effort. */
export async function notifyDoctorOnPayment(
  doctor: Doctor | null | undefined,
  booking: Pick<Booking, "id" | "patientName" | "slotStart" | "priceCents">
): Promise<SendResult | null> {
  if (!doctor) return null;
  const settings = await getWhatsAppSettings();
  if (!shouldNotifyDoctorPaymentWhatsApp(doctor, settings)) return null;
  const phone = doctorPaymentAlertPhone(doctor);
  if (!phone) return null;

  const text = buildDoctorPaymentWhatsApp({
    patientName: booking.patientName,
    slotStart: booking.slotStart,
    priceCents: booking.priceCents,
    bookingId: booking.id,
    tz: doctor.tz,
  });

  const result = await sendWhatsApp(phone, text, { automatic: true });
  await logWhatsAppMessage({
    senderRole: "sistema",
    senderName: "Meu Rim",
    recipient: doctor.name,
    recipientPhone: phone,
    method: result.method,
    status: result.status,
    detail: result.detail || (result.ok ? `pagamento ${booking.id}` : result.url || "falhou"),
  });
  return result;
}
