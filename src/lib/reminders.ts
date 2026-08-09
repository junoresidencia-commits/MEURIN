import "server-only";

import { getDoctorById, updateBooking } from "./store";
import { sendEmail } from "./email";
import type { Booking } from "./types";

const H24 = 24 * 60 * 60 * 1000;
const H2 = 2 * 60 * 60 * 1000;

/**
 * Envia lembretes de consulta (24h e 2h antes) uma única vez. Como não há cron,
 * é processado quando o médico abre a agenda / lista de consultas (best-effort).
 * Marca reminder24Sent/reminder2Sent para não reenviar.
 */
export async function processReminders(bookings: Booking[]): Promise<Booking[]> {
  const now = Date.now();
  const out: Booking[] = [];
  for (const b of bookings) {
    if (b.status !== "confirmed") {
      out.push(b);
      continue;
    }
    const start = new Date(b.slotStart).getTime();
    const diff = start - now;
    let patch: Partial<Booking> | null = null;

    if (diff > 0 && diff <= H2 && !b.reminder2Sent) {
      patch = { reminder2Sent: true, reminder24Sent: true };
      await notify(b, "hoje");
    } else if (diff > 0 && diff <= H24 && !b.reminder24Sent) {
      patch = { reminder24Sent: true };
      await notify(b, "amanhã");
    }

    if (patch) {
      const updated = await updateBooking(b.id, patch);
      out.push(updated ?? { ...b, ...patch });
    } else {
      out.push(b);
    }
  }
  return out;
}

async function notify(b: Booking, when: "hoje" | "amanhã") {
  const hora = new Date(b.slotStart).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const doctor = await getDoctorById(b.doctorId);
  const local = b.modality === "teleconsulta" ? "Teleconsulta (online)" : b.locationName || "presencial";
  if (b.patientEmail?.includes("@")) {
    await sendEmail({
      to: b.patientEmail,
      subject: when === "hoje" ? "Lembrete: sua consulta é hoje" : "Lembrete: sua consulta é amanhã",
      body: `Lembrete da sua consulta com ${doctor?.name ?? "seu médico"} — ${hora} · ${local}.`,
    });
  }
}
