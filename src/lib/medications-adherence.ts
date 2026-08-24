import type { Medication, AdherenceLog } from "./medications-store";

export const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "esqueci", label: "Esqueci" },
  { value: "acabou", label: "Medicamento acabou" },
  { value: "nao_comprou", label: "Não consegui comprar" },
  { value: "efeito_colateral", label: "Tive efeito colateral" },
  { value: "nao_entendi", label: "Não entendi como tomar" },
  { value: "fora_de_casa", label: "Estava fora de casa" },
  { value: "medico_suspendeu", label: "Outro médico orientou suspender" },
  { value: "outro", label: "Outro" },
];
export function reasonLabel(value?: string | null): string {
  if (!value) return "";
  return REASON_OPTIONS.find((r) => r.value === value)?.label || value;
}

export type DoseState = "taken" | "missed" | "none";
export type DayStatus = "todas" | "parcial" | "varias" | "sem_info";

export interface DoseView {
  medicationId: string;
  medName: string;
  dose: string | null;
  time: string;
  status: DoseState;
  reason: string | null;
  reasonText: string | null;
}
export interface DayView {
  date: string; // YYYY-MM-DD
  doses: DoseView[];
  status: DayStatus;
  counts: { taken: number; missed: number; none: number };
}

/** Data de "hoje" no fuso local do app. */
export function todayStr(tz = "America/Bahia"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Lista de datas (YYYY-MM-DD) de `from` até `to` inclusive, em ordem crescente. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(d.toLocaleDateString("en-CA"));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Um medicamento é "agendado" num dia se já existia e ainda não estava suspenso naquele dia. */
export function medActiveOnDay(med: Medication, day: string): boolean {
  const created = (med.createdAt || "").slice(0, 10);
  if (created && day < created) return false;
  if (med.status === "suspended") {
    const susp = (med.suspendedAt || "").slice(0, 10);
    if (susp && day >= susp) return false;
  }
  return true;
}

function dayStatusFrom(counts: { taken: number; missed: number; none: number }): DayStatus {
  const scheduled = counts.taken + counts.missed + counts.none;
  if (scheduled === 0) return "sem_info";
  if (counts.missed === 0 && counts.none === 0) return "todas";
  if (counts.missed >= 2 || (counts.missed > 0 && counts.missed === scheduled)) return "varias";
  if (counts.missed >= 1) return "parcial";
  return "sem_info";
}

/** Monta a visão por dia (doses agendadas + status), para um intervalo. */
export function buildDays(meds: Medication[], logs: AdherenceLog[], from: string, to: string, medicationId?: string): DayView[] {
  const logKey = (l: AdherenceLog) => `${l.medicationId}|${l.date}|${l.time}`;
  const logMap = new Map(logs.map((l) => [logKey(l), l]));
  const scoped = medicationId ? meds.filter((m) => m.id === medicationId) : meds;
  const days = dateRange(from, to);
  const views: DayView[] = [];
  for (const day of days) {
    const doses: DoseView[] = [];
    for (const med of scoped) {
      if (!medActiveOnDay(med, day)) continue;
      for (const time of (med.times || [])) {
        const l = logMap.get(`${med.id}|${day}|${time}`);
        doses.push({
          medicationId: med.id,
          medName: med.name,
          dose: med.dose,
          time,
          status: l ? l.status : "none",
          reason: l?.reason ?? null,
          reasonText: l?.reasonText ?? null,
        });
      }
    }
    if (doses.length === 0) continue;
    doses.sort((a, b) => a.time.localeCompare(b.time) || a.medName.localeCompare(b.medName));
    const counts = {
      taken: doses.filter((d) => d.status === "taken").length,
      missed: doses.filter((d) => d.status === "missed").length,
      none: doses.filter((d) => d.status === "none").length,
    };
    views.push({ date: day, doses, status: dayStatusFrom(counts), counts });
  }
  // Ordem cronológica inversa: hoje → ontem → anteriores.
  views.reverse();
  return views;
}

export interface AdherenceSummary {
  scheduled: number;
  taken: number;
  missed: number;
  none: number;
  adherencePct: number | null; // tomadas / (tomadas + não tomadas)
  topReason: { value: string; label: string; count: number } | null;
  outOfMedEpisodes: number; // episódios por falta do medicamento
  rangeDays: number;
}

export function summarize(days: DayView[]): AdherenceSummary {
  let taken = 0, missed = 0, none = 0;
  const reasonCounts = new Map<string, number>();
  for (const d of days) {
    taken += d.counts.taken; missed += d.counts.missed; none += d.counts.none;
    for (const dose of d.doses) {
      if (dose.status === "missed" && dose.reason) reasonCounts.set(dose.reason, (reasonCounts.get(dose.reason) || 0) + 1);
    }
  }
  const scheduled = taken + missed + none;
  const informed = taken + missed;
  const adherencePct = informed > 0 ? Math.round((taken / informed) * 100) : null;
  let topReason: AdherenceSummary["topReason"] = null;
  for (const [value, count] of reasonCounts) {
    if (!topReason || count > topReason.count) topReason = { value, label: reasonLabel(value), count };
  }
  const outOfMedEpisodes = reasonCounts.get("acabou") || 0;
  return { scheduled, taken, missed, none, adherencePct, topReason, outOfMedEpisodes, rangeDays: days.length };
}
