import "server-only";

import { getDoctorById, readDb, updateBooking } from "./store";
import { sendEmail } from "./email";
import { sendNotification, patientKey, links, fmtTime } from "./notify";
import type { Booking } from "./types";

const H24 = 24 * 60 * 60 * 1000;
const H2 = 2 * 60 * 60 * 1000;

/**
 * Envia lembretes de consulta (24h e 2h antes) uma única vez, por e-mail + push + central.
 * Marca reminder24Sent/reminder2Sent para não reenviar. Rodado pelo cron e, como
 * fallback best-effort, quando o médico abre a agenda.
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
      await notify(b, "2h");
    } else if (diff > 0 && diff <= H24 && !b.reminder24Sent) {
      patch = { reminder24Sent: true };
      await notify(b, "24h");
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

/** Varredura global (para o cron): processa TODAS as consultas confirmadas futuras. */
export async function runReminderSweep(): Promise<{ scanned: number; sent24: number; sent2: number }> {
  const db = await readDb();
  const now = Date.now();
  let sent24 = 0;
  let sent2 = 0;
  const confirmed = db.bookings.filter((b) => b.status === "confirmed");
  for (const b of confirmed) {
    const diff = new Date(b.slotStart).getTime() - now;
    if (diff > 0 && diff <= H2 && !b.reminder2Sent) {
      await notify(b, "2h");
      await updateBooking(b.id, { reminder2Sent: true, reminder24Sent: true });
      sent2++;
    } else if (diff > 0 && diff <= H24 && !b.reminder24Sent) {
      await notify(b, "24h");
      await updateBooking(b.id, { reminder24Sent: true });
      sent24++;
    }
  }
  return { scanned: confirmed.length, sent24, sent2 };
}

async function notify(b: Booking, when: "24h" | "2h") {
  const doctor = await getDoctorById(b.doctorId);
  const tz = doctor?.tz || "America/Bahia";
  const hora = fmtTime(b.slotStart, tz);
  const online = b.modality === "teleconsulta";

  // E-mail (mantido)
  if (b.patientEmail?.includes("@")) {
    const local = online ? "Teleconsulta (online)" : b.locationName || "presencial";
    await sendEmail({
      to: b.patientEmail,
      subject: when === "2h" ? "Lembrete: sua consulta é hoje" : "Lembrete: sua consulta é amanhã",
      body: `Lembrete da sua consulta com ${doctor?.name ?? "seu médico"} — ${when === "2h" ? "hoje" : "amanhã"} às ${hora} · ${local}.`,
    });
  }

  // Push + central (discreto, sem dado clínico)
  const body =
    when === "2h"
      ? online
        ? `Sua consulta online começa às ${hora}. Toque para acessar.`
        : `Sua consulta começa às ${hora}.`
      : `Você tem uma consulta amanhã às ${hora}.`;
  await sendNotification({
    userId: patientKey(b.patientEmail),
    role: "paciente",
    type: when === "2h" ? "lembrete_2h" : "lembrete_24h",
    title: "Lembrete de consulta",
    body,
    targetUrl: links.patientConsulta(b.id),
    tag: `reminder-${b.id}-${when}`,
    relatedType: "booking",
    relatedId: b.id,
  });
}
