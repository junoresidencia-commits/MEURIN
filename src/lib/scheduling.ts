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
  locationCity?: string;
  priceCents: number;
  visitKind?: "consulta" | "retorno" | "ambos";
  tz?: string;
}

export const DOCTOR_TZ_DEFAULT = "America/Bahia";

const WEEKDAY_DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function ymdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Interpreta HH:mm num dia civil no fuso do médico e devolve o instante UTC. */
export function zonedDateTimeToUtc(ymd: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const seenMs = (ms: number) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(ms));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value || 0);
    let h = g("hour");
    if (h === 24) h = 0;
    return Date.UTC(g("year"), g("month") - 1, g("day"), h, g("minute"));
  };
  let utc = wanted;
  utc -= seenMs(utc) - wanted;
  utc -= seenMs(utc) - wanted;
  return new Date(utc);
}

function weekdayInTimeZone(ymd: string, timeZone: string): number {
  const noon = zonedDateTimeToUtc(ymd, "12:00", timeZone);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noon);
  return WEEKDAY_DOW[wd] ?? noon.getUTCDay();
}

function formatSlotInZone(date: Date, timeZone: string): string {
  return date.toLocaleString("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type VisitKindFilter = "consulta" | "retorno" | "all";

export function slotMatchesVisit(
  slot: { visitKind?: "consulta" | "retorno" | "ambos" },
  visit: Exclude<VisitKindFilter, "all">
): boolean {
  const kind = slot.visitKind || "ambos";
  return kind === "ambos" || kind === visit;
}

/**
 * Filtra horários pelo tipo pedido. Se o médico publicou só o outro tipo
 * (agenda “certa” de consulta ou de retorno), devolve esses horários mesmo assim
 * para o paciente conseguir marcar.
 */
export function slotsForVisit<T extends { visitKind?: "consulta" | "retorno" | "ambos" }>(
  slots: T[],
  visit: VisitKindFilter
): T[] {
  if (visit === "all") return slots;
  const matched = slots.filter((s) => slotMatchesVisit(s, visit));
  return matched.length > 0 ? matched : slots;
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
  const tz = doctor.tz || DOCTOR_TZ_DEFAULT;
  const exclude = new Set<string>([...(doctor.blockedSlots || []), ...(opts.excludeStarts || [])]);
  const locations = doctor.locations || [];
  const locOf = (id?: string) => locations.find((l) => l.id === id);
  const locActive = (id?: string) => Boolean(locOf(id)?.active);

  const periods = doctor.availabilityPeriods && doctor.availabilityPeriods.length > 0
    ? doctor.availabilityPeriods
    : fallbackPeriods(doctor);

  const out: AvailableSlot[] = [];
  let ymd = ymdInTimeZone(now, tz);
  for (let d = 0; d < daysAhead; d++) {
    const dow = weekdayInTimeZone(ymd, tz);
    for (const p of periods) {
      if (p.dayOfWeek !== dow) continue;
      if (opts.modality && p.modality !== opts.modality) continue;
      if (p.modality === "presencial") {
        if (!p.locationId || !locActive(p.locationId)) continue; // local inativo/ausente não aparece
        if (opts.locationId && p.locationId !== opts.locationId) continue;
      }
      const loc = p.modality === "presencial" ? locOf(p.locationId) : undefined;
      const step = Math.max(5, (p.durationMin || SLOT_MINUTES) + (p.intervalMin || 0));
      const dur = p.durationMin || SLOT_MINUTES;
      let cursor = zonedDateTimeToUtc(ymd, p.start, tz);
      const end = zonedDateTimeToUtc(ymd, p.end, tz);
      while (addMinutes(cursor, dur).getTime() <= end.getTime()) {
        const slotEnd = addMinutes(cursor, dur);
        const startIso = cursor.toISOString();
        if (cursor > now && !exclude.has(startIso)) {
          out.push({
            start: startIso,
            end: slotEnd.toISOString(),
            label: formatSlotInZone(cursor, tz),
            modality: p.modality,
            locationId: p.modality === "presencial" ? p.locationId : undefined,
            locationName: loc ? (loc.city ? `${loc.name} — ${loc.city}` : loc.name) : undefined,
            locationCity: loc?.city,
            priceCents: p.priceCents ?? doctor.consultationPriceCents,
            visitKind: p.visitKind || "ambos",
            tz,
          });
        }
        cursor = addMinutes(cursor, step);
      }
    }
    ymd = nextYmd(ymd);
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
