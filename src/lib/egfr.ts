/**
 * TFGe pela equação CKD-EPI Creatinina 2021 (sem fator raça), padrão atual.
 * Client-safe. Retorna também metadados para preservar a origem do cálculo.
 */

export type Sex = "male" | "female";
export const EGFR_EQUATION = "CKD-EPI";
export const EGFR_VERSION = "2021";

export function ageFromBirthdate(birthdate?: string | null, at?: Date): number | null {
  if (!birthdate) return null;
  const d = new Date(birthdate);
  if (Number.isNaN(d.getTime())) return null;
  const ref = at || new Date();
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function normalizeSex(sex?: string | null): Sex | null {
  if (!sex) return null;
  const s = sex.trim().toLowerCase();
  if (!s) return null;
  if (/^f|fem|mulher/.test(s)) return "female";
  if (/^m|masc|homem/.test(s)) return "male";
  return null;
}

export function ckdEpi2021(creatinine: number, ageYears: number, sex: Sex): number {
  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.241 : -0.302;
  const ratio = creatinine / kappa;
  const egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, ageYears) *
    (sex === "female" ? 1.012 : 1);
  return Math.round(egfr * 10) / 10;
}

export function estimateEgfr(
  creatinine: number,
  birthdate?: string | null,
  sex?: string | null,
  measuredAt?: string
): number | null {
  if (!Number.isFinite(creatinine) || creatinine <= 0) return null;
  const age = ageFromBirthdate(birthdate, measuredAt ? new Date(measuredAt) : undefined);
  const normSex = normalizeSex(sex);
  if (age == null || !normSex) return null;
  return ckdEpi2021(creatinine, age, normSex);
}
