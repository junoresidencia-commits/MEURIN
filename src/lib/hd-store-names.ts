import type { HdExamCode } from "./hd-types";

export function normName(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function matchExamCode(raw: string): HdExamCode | null {
  const u = normName(raw);
  const table: Array<[RegExp, HdExamCode]> = [
    [/HEMOGLOB/, "hb"],
    [/\bHB\b/, "hb"],
    [/HEMATOCR/, "ht"],
    [/\bHT\b/, "ht"],
    [/FERRIT/, "ferritin"],
    [/TSAT|SATURA/, "tsat"],
    [/FERRO/, "serum_iron"],
    [/CALCIO|\bCA\b/, "ca"],
    [/FOSFOR|\bP\b/, "p"],
    [/\bPTH\b|PARAT/, "pth"],
    [/POTASS|\bK\b/, "k"],
    [/ALBUM/, "albumin"],
    [/BICARB|HCO/, "hco3"],
    [/UREIA PRE|PRE[- ]DIAL/, "urea_pre"],
    [/UREIA POS|POS[- ]DIAL/, "urea_post"],
    [/UREIA/, "urea_pre"],
    [/CREAT/, "creat"],
    [/SODIO|\bNA\b/, "na"],
  ];
  for (const [re, code] of table) if (re.test(u)) return code;
  return null;
}
