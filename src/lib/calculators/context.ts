import { normalizeSex } from "../egfr";
import { resolvePatientAge } from "../patient-age";
import type { CalcContext } from "./types";

export type RawLab = { testKey: string; value: number; unit?: string | null; measuredAt: string };

function latestByKey(labs: RawLab[]): CalcContext["labs"] {
  const map: CalcContext["labs"] = {};
  const sorted = [...labs].sort((a, b) => String(b.measuredAt).localeCompare(String(a.measuredAt)));
  for (const l of sorted) {
    if (!map[l.testKey]) map[l.testKey] = { value: l.value, unit: l.unit, measuredAt: l.measuredAt };
  }
  return map;
}

function parseMeds(raw?: string | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/\n|;|,/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function yes(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  if (s === "sim" || s === "true" || s === "1") return true;
  if (s === "nao" || s === "não" || s === "false" || s === "0") return false;
  return null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function daysOld(iso?: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 86400000));
}

export function staleWarning(label: string, iso?: string | null, limit = 90): string | null {
  const d = daysOld(iso);
  if (d == null || d < limit) return null;
  return `Atenção: ${label} utilizada tem ${d} dias.`;
}

export function buildCalcContext(input: {
  patientName?: string | null;
  birthdate?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
  sex?: string | null;
  labs?: RawLab[];
  profile?: Record<string, unknown>;
  sbp?: number | null;
  dbp?: number | null;
  bpAt?: string | null;
  extra?: Record<string, number | string | boolean | null>;
}): CalcContext {
  const profile = input.profile || {};
  const ageYears = resolvePatientAge(
    { birthdate: input.birthdate, ageYears: input.ageYears, ageReportedAt: input.ageReportedAt },
    new Date().toISOString()
  );
  const weightKg = num(profile.peso_kg);
  const heightCm = num(profile.altura_cm);
  let bmi: number | null = null;
  if (weightKg && heightCm && heightCm > 0) {
    const m = heightCm / 100;
    bmi = Math.round((weightKg / (m * m)) * 10) / 10;
  }
  const hd = yes(profile.hemodialise) === true;
  const dp = yes(profile.dialise_peritoneal) === true;
  const tx = yes(profile.transplante) === true;
  const medsRaw = String(profile.medicamentos_em_uso || "");
  return {
    patientName: input.patientName || null,
    ageYears,
    sex: normalizeSex(input.sex),
    birthdate: input.birthdate || null,
    weightKg,
    heightCm,
    bmi,
    onKrt: hd || dp || tx,
    knownCvd: yes(profile.dcv) === true || yes(profile.ic) === true,
    diabetes: yes(profile.dm),
    smoking: yes(profile.tabagismo),
    antihypertensive: yes(profile.has) === true ? true : null,
    statin: /estatin|sinvastat|atorvastat|rosuvastat/i.test(medsRaw) ? true : null,
    meds: parseMeds(medsRaw),
    medsRaw,
    labs: latestByKey(input.labs || []),
    sbp: input.sbp ?? num(profile.pas),
    dbp: input.dbp ?? num(profile.pad),
    bpAt: input.bpAt || null,
    extra: input.extra || {},
  };
}
