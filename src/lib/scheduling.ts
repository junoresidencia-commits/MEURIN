import { addDays, addMinutes, format, getDay, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Doctor, WeeklySlot } from "./types";

const SLOT_MINUTES = 30;

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return setMinutes(setHours(date, h), m);
}

export function generateSlotsForDoctor(
  doctor: Doctor,
  daysAhead = 14
): { start: string; end: string; label: string }[] {
  const slots: { start: string; end: string; label: string }[] = [];
  const now = new Date();
  const booked = new Set([
    ...doctor.blockedSlots,
  ]);

  for (let d = 0; d < daysAhead; d++) {
    const day = addDays(now, d);
    const dow = getDay(day);
    const windows = doctor.weeklyAvailability.filter((w) => w.dayOfWeek === dow);

    for (const window of windows) {
      let cursor = parseTimeOnDate(day, window.start);
      const end = parseTimeOnDate(day, window.end);

      while (addMinutes(cursor, SLOT_MINUTES) <= end) {
        const slotEnd = addMinutes(cursor, SLOT_MINUTES);
        if (cursor > now) {
          const startIso = cursor.toISOString();
          if (!booked.has(startIso)) {
            slots.push({
              start: startIso,
              end: slotEnd.toISOString(),
              label: format(cursor, "EEEE, d MMM · HH:mm", { locale: ptBR }),
            });
          }
        }
        cursor = slotEnd;
      }
    }
  }

  return slots;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatSlot(iso: string): string {
  return format(new Date(iso), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export function weekdayLabel(day: number): string {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return labels[day] ?? "";
}

export function defaultAvailability(): WeeklySlot[] {
  return [
    { dayOfWeek: 1, start: "08:00", end: "12:00" },
    { dayOfWeek: 1, start: "14:00", end: "18:00" },
    { dayOfWeek: 2, start: "08:00", end: "12:00" },
    { dayOfWeek: 2, start: "14:00", end: "18:00" },
    { dayOfWeek: 3, start: "08:00", end: "12:00" },
    { dayOfWeek: 3, start: "14:00", end: "18:00" },
    { dayOfWeek: 4, start: "08:00", end: "12:00" },
    { dayOfWeek: 4, start: "14:00", end: "18:00" },
    { dayOfWeek: 5, start: "08:00", end: "12:00" },
  ];
}
