/**
 * Números de laudo brasileiro: ponto milhar, vírgula decimal.
 * 12.013 mg → 12013; 806,6 → 806.6; 1,2 g → 1.2
 *
 * Em gramas, "12.013" é decimal (12,013 g), não milhar — 12013 g/dia não é fisiológico.
 */
export type LabMassFamily = "g" | "mg" | "other";

export function foldLabText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parsePtBrLabNumber(raw: string, massFamily: LabMassFamily = "other"): number {
  const s = String(raw || "").replace(/[<>\s]/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      return Number(s.replace(/\./g, "").replace(",", "."));
    }
    return Number(s.replace(/,/g, ""));
  }
  if (hasComma) return Number(s.replace(",", "."));
  if (hasDot) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 2) return Number(s.replace(/\./g, ""));
    if (last.length === 3 && massFamily !== "g") return Number(s.replace(/\./g, ""));
    return Number(s);
  }
  return Number(s);
}

const NUM_BODY =
  "\\d{1,3}(?:\\.\\d{3})+,\\d{1,4}|\\d{1,3}(?:\\.\\d{3})+|\\d{1,8}[.,]\\d{1,4}|\\d{1,8}";

/** Captura o próximo número de laudo (milhar BR ou decimal). */
export const LAB_NUMBER_RE = new RegExp(`([<>]?\\s*(?:${NUM_BODY}))`);

export function massFamilyFromUnit(unitRaw: string): LabMassFamily {
  const u = foldLabText(unitRaw).replace(/\s+/g, "");
  if (/^g(?:\/|$)/.test(u) && !/^g(?:\/g|\/mg)/.test(u)) return "g";
  if (/^(mg|mcg|ug|µg|μg)/.test(u)) return "mg";
  return "other";
}
