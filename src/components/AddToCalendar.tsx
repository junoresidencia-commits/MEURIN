"use client";

import { useState } from "react";

type Props = {
  bookingId: string;
  slotStart: string;
  slotEnd?: string;
  modality?: string | null;
  locationName?: string | null;
};

function gcalDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Botão "Adicionar ao calendário": baixa .ics (iPhone/Android/desktop) e link do Google Agenda. */
export function AddToCalendar({ bookingId, slotStart, slotEnd, modality, locationName }: Props) {
  const [open, setOpen] = useState(false);
  const online = modality === "teleconsulta";
  const title = online ? "Teleconsulta — Meu Rim" : "Consulta — Meu Rim";
  const end = slotEnd || new Date(new Date(slotStart).getTime() + 30 * 60000).toISOString();
  const location = online ? "Teleconsulta (online) — Meu Rim" : locationName || "";
  const details = online ? "Consulta online pelo Meu Rim." : "Consulta agendada pelo Meu Rim.";
  const gcal =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${gcalDate(slotStart)}/${gcalDate(end)}` +
    `&details=${encodeURIComponent(details)}` +
    (location ? `&location=${encodeURIComponent(location)}` : "");

  return (
    <div className="relative inline-block">
      <button type="button" className="btn-ghost" onClick={() => setOpen((v) => !v)}>
        Adicionar ao calendário
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-xl">
          <a
            href={`/api/bookings/${bookingId}/ics`}
            className="block px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-soft)]"
            onClick={() => setOpen(false)}
          >
            📆 Calendário do celular (.ics)
          </a>
          <a
            href={gcal}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-soft)]"
            onClick={() => setOpen(false)}
          >
            🗓️ Google Agenda
          </a>
        </div>
      )}
    </div>
  );
}
