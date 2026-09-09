import { NEPHRO_LABS, labUnit } from "./labs";
import { LAB_NUMBER_RE, foldLabText, massFamilyFromUnit, parsePtBrLabNumber } from "./lab-number";

export type UrinaryParsed = {
  testKey: string;
  label: string;
  value: number;
  unit: string;
  raw: string;
};

type NameHint =
  | "proteinuria24"
  | "proteinuria"
  | "rac"
  | "rpc"
  | "aer24"
  | "uaConc"
  | "uaAmbiguous";

type UnitClass = "day" | "ratio" | "conc";

type Occupied = { start: number; end: number };

const NAME_RULES: { hint: NameHint; re: RegExp }[] = [
  { hint: "aer24", re: /excrecao\s+urinaria\s+de\s+albumina/g },
  { hint: "aer24", re: /(?:micro)?albuminuria(?:\s+de)?\s*24\s*h(?:oras?)?/g },
  { hint: "aer24", re: /albumina\s+urinaria(?:\s+de)?\s*24\s*h(?:oras?)?/g },
  { hint: "proteinuria24", re: /proteinuria(?:\s+de)?\s*24\s*h(?:oras?)?/g },
  { hint: "proteinuria24", re: /proteina(?:s)?(?:\s+total)?(?:\s+urinaria(?:s)?)?(?:\s+de)?\s*24\s*h(?:oras?)?/g },
  { hint: "proteinuria24", re: /proteinas?\s*[-–]?\s*dosagem(?:\s*\/?\s*amostra(?:\s+de)?\s+urina(?:\s+de)?\s*24\s*h(?:oras?)?)?/g },
  { hint: "proteinuria24", re: /amostra(?:\s+de)?\s+urina(?:\s+de)?\s*24\s*h(?:oras?)?/g },
  { hint: "rac", re: /relacao\s+albumina\s*\/\s*creatinina(?:\s+urinaria)?/g },
  { hint: "rac", re: /albumina\s*\/\s*creatinina(?:\s+urinaria)?/g },
  { hint: "rpc", re: /relacao\s+proteina(?:s)?\s*\/\s*creatinina/g },
  { hint: "rpc", re: /proteina(?:s)?\s*\/\s*creatinina/g },
  { hint: "rac", re: /microalbuminuria(?:[\s\w]{0,40})?(?:em\s+)?(?:mg|mcg|ug)\s*\/\s*(?:g|mg)/g },
  { hint: "rac", re: /\b(?:uacr|acr|rac)\b/g },
  { hint: "uaConc", re: /albumina\s+urinaria(?!\s*(?:de\s*)?24)/g },
  { hint: "uaAmbiguous", re: /microalbuminuria/g },
  { hint: "uaAmbiguous", re: /(?<!micro)albuminuria(?!\s*(?:de\s*)?24)/g },
  { hint: "proteinuria", re: /\bproteinuria\b(?!\s*(?:de\s*)?24)/g },
];

const UNIT_RE =
  /((?:mcg|ug|µg|μg|mg|g)\s*\/\s*(?:24\s*h(?:oras?)?|dia|g|mg|l)(?:\s*(?:de\s+)?(?:creatinina|creat))?)/i;

function overlaps(a: Occupied, b: Occupied): boolean {
  return a.start < b.end && b.start < a.end;
}

function classifyUnit(unitRaw: string): { cls: UnitClass; gramDay: boolean } | null {
  const u = foldLabText(unitRaw).replace(/\s+/g, "");
  if (!u) return null;
  if (/(?:mg|g)\/(?:24h(?:oras?)?|24|dia)/.test(u)) {
    return { cls: "day", gramDay: /^g\//.test(u) };
  }
  if (/(?:mcg|ug|µg|μg)\/mg/.test(u) || /mg\/g/.test(u) || /(?:mg|mcg|ug)\/(?:mg)?creat/.test(u)) {
    return { cls: "ratio", gramDay: false };
  }
  if (/(?:mg|mcg|ug|µg)\/(?:l|ml)/.test(u)) {
    return { cls: "conc", gramDay: false };
  }
  return null;
}

function decideKey(hint: NameHint, unitCls: UnitClass | null): string | null {
  if (hint === "proteinuria24") {
    if (unitCls === "ratio") return "rpc";
    return "proteinuria_24h";
  }
  if (hint === "proteinuria") {
    return unitCls === "day" ? "proteinuria_24h" : null;
  }
  if (hint === "rac") return "rac";
  if (hint === "rpc") return "rpc";
  if (hint === "aer24") {
    if (unitCls === "ratio") return "rac";
    if (unitCls === "conc") return "microalbuminuria";
    return "albuminuria_24h";
  }
  if (hint === "uaConc" || hint === "uaAmbiguous") {
    if (unitCls === "ratio") return "rac";
    if (unitCls === "day") return "albuminuria_24h";
    return "microalbuminuria";
  }
  return null;
}

function convertValue(key: string, value: number, unitRaw: string): { value: number; unit: string } {
  const unitInfo = classifyUnit(unitRaw);
  if (key === "proteinuria_24h" || key === "albuminuria_24h") {
    if (unitInfo?.gramDay) return { value: value * 1000, unit: labUnit(key) };
    return { value, unit: labUnit(key) };
  }
  return { value, unit: labUnit(key) };
}

function isDipstick(rest: string): boolean {
  return /^\s*(?:\+{1,4}|[1-4]\s*\+|tracos?|negativ\w*|ausente)/i.test(rest);
}

function readResult(folded: string, from: number): { rawNum: string; value: number; unitRaw: string; end: number } | null {
  const window = folded.slice(from, from + 140);
  if (isDipstick(window)) return null;
  const re = new RegExp(LAB_NUMBER_RE.source, "g");
  for (const numMatch of window.matchAll(re)) {
    if (numMatch.index == null || numMatch.index > 100) break;
    const junk = window.slice(0, numMatch.index);
    if (/\b(?:rac|uacr|acr|rpc)\b/.test(junk)) return null;
    if (/(?<!\bde\s)\b(?:creatinina|tfge|ureia|potassio)\b/.test(junk)) return null;

    const afterNum = window.slice(numMatch.index + numMatch[0].length);
    if (/^\s*\+/.test(afterNum)) continue;
    // "24h" da coleta e datas 18/08/2026 não são o resultado.
    if (/^\s*h(?:oras?)?\b/.test(afterNum)) continue;
    if (/^\s*[/.\\-]\d/.test(afterNum)) continue;

    const unitMatch = afterNum.match(new RegExp("^\\s*" + UNIT_RE.source, "i"));
    const unitRaw = unitMatch ? unitMatch[1] : "";
    const mass = massFamilyFromUnit(unitRaw);
    const value = parsePtBrLabNumber(numMatch[1], mass);
    if (!Number.isFinite(value)) continue;
    const end = from + numMatch.index + numMatch[0].length + (unitMatch ? unitMatch[0].length : 0);
    return { rawNum: numMatch[1], value, unitRaw, end };
  }
  return null;
}

/**
 * Proteinúria 24h, RAC, albumina urinária (mg/L) e albuminúria 24h —
 * campos separados, com unidade mandando na desambiguação.
 */
export function extractUrinaryLabs(text: string): { labs: UrinaryParsed[]; occupied: Occupied[] } {
  const folded = foldLabText(text);
  const occupied: Occupied[] = [];
  const seen = new Set<string>();
  const labs: UrinaryParsed[] = [];

  for (const rule of NAME_RULES) {
    const re = new RegExp(rule.re.source, "g");
    for (const m of folded.matchAll(re)) {
      const start = m.index ?? 0;
      const nameEnd = start + m[0].length;
      const spanName = { start, end: nameEnd };
      if (occupied.some((o) => overlaps(o, spanName))) continue;

      const result = readResult(folded, nameEnd);
      if (!result) continue;

      const unitInfo = result.unitRaw ? classifyUnit(result.unitRaw) : null;
      const key = decideKey(rule.hint, unitInfo?.cls ?? null);
      if (!key || seen.has(key)) continue;
      if (!NEPHRO_LABS.some((l) => l.key === key)) continue;

      const converted = convertValue(key, result.value, result.unitRaw);
      const def = NEPHRO_LABS.find((l) => l.key === key)!;
      seen.add(key);
      occupied.push({ start, end: result.end });
      labs.push({
        testKey: key,
        label: def.label,
        value: converted.value,
        unit: converted.unit,
        raw: folded.slice(start, result.end).trim(),
      });
    }
  }

  return { labs, occupied };
}
