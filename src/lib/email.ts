import type { Booking, Doctor } from "./types";
import { formatBRL, formatSlot } from "./scheduling";

/** Simulated transactional email — logged for demo; swap for Resend/SendGrid in production. */
export function buildConfirmationEmail(
  booking: Booking,
  doctor: Doctor,
  meetingUrl: string
): { to: string; subject: string; body: string } {
  const subject = `Consulta confirmada — Meu Rim com ${doctor.name}`;
  const body = [
    `Olá, ${booking.patientName}!`,
    ``,
    `Seu pagamento foi confirmado e sua consulta de nefrologia está agendada.`,
    ``,
    `Médico(a): ${doctor.name}`,
    `CRM: ${doctor.crm}`,
    `Data/hora: ${formatSlot(booking.slotStart)}`,
    `Valor: ${formatBRL(booking.priceCents)}`,
    ``,
    `Entre na consulta online pelo link abaixo (não precisa de Zoom ou outra plataforma paga):`,
    meetingUrl,
    ``,
    `Guarde este e-mail. Você também pode acessar o link pela página de confirmação.`,
    ``,
    `— Equipe Meu Rim`,
  ].join("\n");

  return { to: booking.patientEmail, subject, body };
}

export function logEmail(email: { to: string; subject: string; body: string }) {
  console.log("\n========== E-MAIL ENVIADO (simulado) ==========");
  console.log(`Para: ${email.to}`);
  console.log(`Assunto: ${email.subject}`);
  console.log(email.body);
  console.log("================================================\n");
}
