/**
 * Idade do paciente — client-safe.
 * Data de nascimento é a fonte principal. Sem nascimento, usa idade manual
 * (com data de referência, se houver). Nunca inventa nem estima data de nascimento.
 */

export type AgeInput = {
  birthdate?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
};

export type AgeBandPreset = {
  id: string;
  label: string;
  op: ">" | "<" | "entre" | ">=";
  value: string;
  value2?: string;
};

/** Faixas pedidas na pesquisa (idade na data de referência do estudo). */
export const AGE_BAND_PRESETS: AgeBandPreset[] = [
  { id: "ge18", label: "≥ 18", op: ">=", value: "18" },
  { id: "18-39", label: "18–39", op: "entre", value: "18", value2: "39" },
  { id: "40-59", label: "40–59", op: "entre", value: "40", value2: "59" },
  { id: "ge60", label: "≥ 60", op: ">=", value: "60" },
];

/** Interpreta YYYY-MM-DD, YYYY-MM, MM/YYYY ou MM/YY como data local (sem UTC). */
export function parseLocalDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      y = Number(m[1]);
      mo = Number(m[2]);
      d = 1;
    } else {
      m = s.match(/^(\d{1,2})\/(\d{4})$/);
      if (m) {
        mo = Number(m[1]);
        y = Number(m[2]);
        d = 1;
      } else {
        m = s.match(/^(\d{1,2})\/(\d{2})$/);
        if (!m) {
          const dt = new Date(s);
          return Number.isNaN(dt.getTime()) ? null : dt;
        }
        mo = Number(m[1]);
        y = 2000 + Number(m[2]);
        d = 1;
      }
    }
  }
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1) return null;
  return dt;
}

export function parseAgeYears(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  const age = Math.round(n);
  return age >= 0 && age < 130 ? age : null;
}

/** Normaliza data de referência para YYYY-MM-DD (1º do mês se só mês/ano). */
export function normalizeAgeReportedAt(raw?: string | null): string | null {
  const dt = parseLocalDate(raw);
  if (!dt) return null;
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function formatAgeReportedAt(raw?: string | null): string {
  const dt = parseLocalDate(raw);
  if (!dt) return "";
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

export function ageFromBirthdate(birthdate?: string | null, at?: Date | string | null): number | null {
  const born = parseLocalDate(birthdate);
  if (!born) return null;
  const ref = at instanceof Date ? at : at ? parseLocalDate(String(at)) : new Date();
  if (!ref || Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - born.getFullYear();
  const m = ref.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Idade na data `at` (inclusão no estudo / referência do pesquisador / hoje).
 * Nascimento vence. Sem nascimento: idade manual projetada a partir da data
 * de referência. Sem os dois: null (dado ausente — não inventa).
 */
export function resolvePatientAge(input: AgeInput, at?: Date | string | null): number | null {
  const fromBirth = ageFromBirthdate(input.birthdate, at);
  if (fromBirth != null) return fromBirth;

  const reported = parseAgeYears(input.ageYears);
  if (reported == null) return null;

  const ref = at instanceof Date ? at : at ? parseLocalDate(String(at)) : new Date();
  if (!ref || Number.isNaN(ref.getTime())) return null;

  const reportedAt = parseLocalDate(input.ageReportedAt);
  if (!reportedAt) {
    return sameCalendarDay(ref, new Date()) ? reported : null;
  }

  let delta = ref.getFullYear() - reportedAt.getFullYear();
  const m = ref.getMonth() - reportedAt.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < reportedAt.getDate())) delta -= 1;
  const age = reported + delta;
  return age >= 0 && age < 130 ? age : null;
}

export function hasAgeInfo(input: AgeInput): boolean {
  return Boolean(parseLocalDate(input.birthdate) || parseAgeYears(input.ageYears) != null);
}

export function ageSource(input: AgeInput): "nascimento" | "manual" | null {
  if (parseLocalDate(input.birthdate)) return "nascimento";
  if (parseAgeYears(input.ageYears) != null) return "manual";
  return null;
}
