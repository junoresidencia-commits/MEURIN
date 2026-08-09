import { addDays, addMinutes, format, getDay, setHours, setMilliseconds, setMinutes, setSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AvailabilityPeriod, Doctor, Modality, WeeklySlot } from "./types";

const SLOT_MINUTES = 30;

export interface AvailableSlot {
  start: string;
  end: string;
  label: string;
  modality: Modality;
  locationId?: string;
  locationName?: string;
  priceCents: number;
}

/** Converte a agenda simples (weeklyAvailability) em períodos de teleconsulta 30/0. */
function fallbackPeriods(doctor: Doctor): AvailabilityPeriod[] {
  return (doctor.weeklyAvailability || []).map((w, i) => ({
    id: `legacy-${i}`,
    dayOfWeek: w.dayOfWeek,
    start: w.start,
    end: w.end,
    modality: "teleconsulta" as Modality,
    durationMin: SLOT_MINUTES,
    intervalMin: 0,
    priceCents: doctor.consultationPriceCents,
  }));
}

/**
 * Gera os horários REAIS do médico a partir dos períodos configurados (local/modalidade,
 * duração, intervalo, valor). Exclui horários ocupados/bloqueados/reservados.
 */
export function generateAvailableSlots(
  doctor: Doctor,
  opts: {
    modality?: Modality;
    locationId?: string;
    daysAhead?: number;
    excludeStarts?: Set<string>;
  } = {}
): AvailableSlot[] {
  const daysAhead = opts.daysAhead ?? 30;
  const now = new Date();
  const exclude = new Set<string>([...(doctor.blockedSlots || []), ...(opts.excludeStarts || [])]);
  const locations = doctor.locations || [];
  const locName = (id?: string) => locations.find((l) => l.id === id)?.name;
  const locActive = (id?: string) => {
    const l = locations.find((x) => x.id === id);
    return l ? l.active : false;
  };

  const periods = doctor.availabilityPeriods && doctor.availabilityPeriods.length > 0
    ? doctor.availabilityPeriods
    : fallbackPeriods(doctor);

  const out: AvailableSlot[] = [];
  for (let d = 0; d < daysAhead; d++) {
    const day = addDays(now, d);
    const dow = getDay(day);
    for (const p of periods) {
      if (p.dayOfWeek !== dow) continue;
      if (opts.modality && p.modality !== opts.modality) continue;
      if (p.modality === "presencial") {
        if (!p.locationId || !locActive(p.locationId)) continue; // local inativo/ausente não aparece
        if (opts.locationId && p.locationId !== opts.locationId) continue;
      }
      const step = Math.max(5, (p.durationMin || SLOT_MINUTES) + (p.intervalMin || 0));
      const dur = p.durationMin || SLOT_MINUTES;
      let cursor = parseTimeOnDate(day, p.start);
      const end = parseTimeOnDate(day, p.end);
      while (addMinutes(cursor, dur) <= end) {
        const slotEnd = addMinutes(cursor, dur);
        const startIso = cursor.toISOString();
        if (cursor > now && !exclude.has(startIso)) {
          out.push({
            start: startIso,
            end: slotEnd.toISOString(),
            label: format(cursor, "EEEE, d MMM · HH:mm", { locale: ptBR }),
            modality: p.modality,
            locationId: p.modality === "presencial" ? p.locationId : undefined,
            locationName: p.modality === "presencial" ? locName(p.locationId) : undefined,
            priceCents: p.priceCents ?? doctor.consultationPriceCents,
          });
        }
        cursor = addMinutes(cursor, step);
      }
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  // Zera segundos/milissegundos: o ISO do horário precisa ser ESTÁVEL entre requisições
  // para casar exatamente reserva (hold) e agendamento (booking).
  return setMilliseconds(setSeconds(setMinutes(setHours(date, h), m), 0), 0);
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
