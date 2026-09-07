/**
 * Classificação KDIGO (categoria G da TFGe e A da albuminúria).
 * Client-safe — usado na extração da evolução e no backfill.
 */

export const G_FROM_EGFR: { g: string; min: number; max: number }[] = [
  { g: "G1", min: 90, max: Infinity },
  { g: "G2", min: 60, max: 89.999 },
  { g: "G3a", min: 45, max: 59.999 },
  { g: "G3b", min: 30, max: 44.999 },
  { g: "G4", min: 15, max: 29.999 },
  { g: "G5", min: 0, max: 14.999 },
];

/** TFGe (mL/min/1,73m²) → categoria G. */
export function gFromEgfr(egfr: number): string | null {
  if (!Number.isFinite(egfr) || egfr < 0) return null;
  const hit = G_FROM_EGFR.find((r) => egfr >= r.min && egfr <= r.max);
  return hit?.g ?? null;
}

/** RAC/UACR em mg/g → A1 <30, A2 30–300, A3 >300. Não usar proteína total. */
export function aFromRac(racMgG: number): "A1" | "A2" | "A3" | null {
  if (!Number.isFinite(racMgG) || racMgG < 0) return null;
  if (racMgG < 30) return "A1";
  if (racMgG <= 300) return "A2";
  return "A3";
}

/**
 * G3 (sem a/b) + TFGe → G3a/G3b. Outros G mencionados prevalecem se
 * compatíveis; se TFGe refina G3, usa a faixa.
 */
export function refineG(mentioned: string | null | undefined, egfr?: number | null): string | null {
  const fromLab = egfr != null ? gFromEgfr(egfr) : null;
  const g = mentioned?.toUpperCase().replace(/\s+/g, "") || null;
  if (g === "G3" && fromLab && (fromLab === "G3a" || fromLab === "G3b")) return fromLab;
  if (g && fromLab && g === fromLab) return g;
  if (g === "G3" && !fromLab) return "G3";
  if (fromLab && (!g || g === "G3")) return fromLab;
  if (g) return g;
  return fromLab;
}

/**
 * G1/G2 isolados não confirmam DRC. G3+ (TFGe <60) ou dano (A2/A3, fita)
 * ou menção explícita de DRC sustentam o diagnóstico.
 */
export function canConfirmDrc(opts: {
  mentionedDrc: boolean;
  g?: string | null;
  a?: string | null;
  proteinuriaFita?: string | null;
  chronicReducedEgfr: boolean;
}): boolean {
  if (opts.mentionedDrc) return true;
  if (opts.chronicReducedEgfr) return true;
  const g = opts.g || "";
  if (/^G3|^G4|^G5/.test(g)) return true;
  if (opts.a === "A2" || opts.a === "A3") return true;
  const fita = opts.proteinuriaFita || "";
  if (["1+", "2+", "3+", "4+"].includes(fita)) return true;
  return false;
}

/** Dois TFGe <60 com ≥90 dias de intervalo → cronicidade. */
export function hasChronicReducedEgfr(
  series: { value: number; at: string }[]
): boolean {
  const low = series
    .filter((s) => Number.isFinite(s.value) && s.value < 60)
    .map((s) => ({ ...s, t: new Date(s.at).getTime() }))
    .filter((s) => Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
  if (low.length < 2) return false;
  return low[low.length - 1].t - low[0].t >= 90 * 86400000;
}
