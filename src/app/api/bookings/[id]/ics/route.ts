import { readDb } from "@/lib/store";
import { getCurrentUser } from "@/lib/current-user";
import { appOrigin } from "@/lib/payments";

function icsDate(iso: string): string {
  // UTC estável (…Z). Evita erro de fuso ao gerar o evento.
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function esc(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Gera o evento .ics da consulta para adicionar ao calendário do celular.
 *  Segurança: o médico só baixa consultas próprias; o paciente acessa pelo id da
 *  consulta (mesma capacidade já usada na página "Minhas consultas"). */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await readDb();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return new Response("Consulta não encontrada.", { status: 404 });

  const doctor = db.doctors.find((d) => d.id === booking.doctorId);
  const user = await getCurrentUser();

  // Papel para decidir o TÍTULO (privacidade do nome do paciente no calendário do médico).
  let asDoctor = false;
  if (user?.role === "medico") {
    if (user.userId !== booking.doctorId) return new Response("Sem permissão.", { status: 403 });
    asDoctor = true;
  }

  const online = booking.modality === "teleconsulta";
  const loc = doctor?.locations?.find((l) => l.id === booking.locationId);
  const meetingUrl = `${appOrigin()}/consulta/${booking.meetingRoomId}`;

  let summary: string;
  if (asDoctor) {
    // Padrão do médico: "meurim" (não expõe nome) OU "patient" (com nome), conforme preferência.
    const mode = doctor?.calendarEventMode || "meurim";
    summary = online
      ? mode === "patient" ? `Teleconsulta — ${booking.patientName}` : "Teleconsulta — Meu Rim"
      : mode === "patient" ? `Consulta — ${booking.patientName}` : "Consulta — Meu Rim";
  } else {
    summary = online ? "Teleconsulta — Meu Rim" : "Consulta — Meu Rim";
  }

  const location = online
    ? "Teleconsulta (online) — Meu Rim"
    : [booking.locationName || loc?.name, loc?.address, loc?.city].filter(Boolean).join(", ");

  const description = online
    ? `Consulta online pelo Meu Rim.\\nAcesse: ${meetingUrl}`
    : "Consulta agendada pelo Meu Rim.";

  const now = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meu Rim//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@meurim`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(booking.slotStart)}`,
    `DTEND:${icsDate(booking.slotEnd)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    location ? `LOCATION:${esc(location)}` : "",
    online ? `URL:${esc(meetingUrl)}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete de consulta — Meu Rim",
    "TRIGGER:-PT60M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const body = lines.join("\r\n");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="consulta-meurim.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
