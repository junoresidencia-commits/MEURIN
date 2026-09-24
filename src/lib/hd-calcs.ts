/** Cálculos determinísticos. Nunca inventam resultado se faltar dado essencial. */

export function parseLocaleNumber(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim().replace(/\s/g, "").replace("%", "");
  if (!s) return null;
  const normalized = s.includes(",") && s.includes(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** URR = (ureia pré − ureia pós) / ureia pré × 100. */
export function calcUrr(ureaPre: number | null, ureaPost: number | null): number | null {
  if (ureaPre == null || ureaPost == null) return null;
  if (ureaPre <= 0 || ureaPost < 0 || ureaPost > ureaPre) return null;
  return Math.round(((ureaPre - ureaPost) / ureaPre) * 1000) / 10;
}

/**
 * Kt/V de Daugirdas (sem UF/peso): só com ureia pré, pós e tempo em horas.
 * Sem tempo ou ureias válidas, retorna null — nunca inventa.
 */
export function calcKtv(
  ureaPre: number | null,
  ureaPost: number | null,
  hours: number | null,
  ufKg: number | null = null,
  weightKg: number | null = null
): number | null {
  if (ureaPre == null || ureaPost == null || hours == null) return null;
  if (ureaPre <= 0 || ureaPost <= 0 || ureaPost >= ureaPre || hours <= 0) return null;
  const r = ureaPost / ureaPre;
  const ln = -Math.log(r - 0.008 * hours);
  let ktv = ln;
  if (ufKg != null && weightKg != null && weightKg > 0 && ufKg >= 0) {
    ktv = ln + (4 - 3.5 * r) * (ufKg / weightKg);
  }
  if (!Number.isFinite(ktv)) return null;
  return Math.round(ktv * 100) / 100;
}

export function parseHours(timeRaw: string | null | undefined): number | null {
  if (!timeRaw) return null;
  const s = String(timeRaw).trim().toUpperCase().replace("H", "").replace(",", ".").trim();
  const m = s.match(/^(\d+)(?::(\d+))?/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(h) || h <= 0) return null;
  return h + min / 60;
}
