import type { Booking, Doctor } from "./types";
import { formatBRL, formatSlot } from "./scheduling";

/** Simulated transactional email — logged for demo; swap for Resend/SendGrid in production. */
export function buildConfirmationEmail(
  booking: Booking,
  doctor: Doctor,
  meetingUrl: string
): { to: string; subject: string; body: string } {
  const subject = `Consulta liberada — Meu Rim com ${doctor.name}`;
  const body = [
    `Olá, ${booking.patientName}!`,
    ``,
    `Pagamento confirmado. Sua consulta de nefrologia online está liberada.`,
    ``,
    `Médico(a): ${doctor.name}`,
    `CRM: ${doctor.crm}`,
    `Data/hora: ${formatSlot(booking.slotStart)}`,
    booking.patientCity ? `Cidade informada: ${booking.patientCity}` : "",
    `Valor: ${formatBRL(booking.priceCents)}`,
    ``,
    `Entre na sala Meu Rim pelo link (não precisa de Zoom ou outro app pago):`,
    meetingUrl,
    ``,
    `No horário, abra o link no celular ou computador com câmera e microfone.`,
    `Em emergência (dor forte, falta de ar, desmaio), procure o pronto-socorro.`,
    ``,
    `— Equipe Meu Rim`,
    `Nefrologia online para quem a distância ou a fila atrapalham.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { to: booking.patientEmail, subject, body };
}

export function logEmail(email: { to: string; subject: string; body: string }) {
  console.log("\n========== E-MAIL ENVIADO (simulado) ==========");
  console.log(`Para: ${email.to}`);
  console.log(`Assunto: ${email.subject}`);
  console.log(email.body);
  console.log("================================================\n");
}
