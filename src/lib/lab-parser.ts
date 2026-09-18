import { NEPHRO_LABS, labUnit } from "./labs";
import { LAB_NUMBER_RE, foldLabText, parsePtBrLabNumber } from "./lab-number";
import { extractUrinaryLabs } from "./lab-urinary";

export type ParsedLab = {
  testKey: string;
  label: string;
  value: number;
  unit: string;
  raw: string;
};

export type ParseResult = {
  labs: ParsedLab[];
  date?: string; // YYYY-MM-DD, quando encontrada no texto
};

/** Um bloco de exames pertencente a UMA data (ou sem data, quando não identificada). */
export type ParsedLabGroup = {
  date?: string; // YYYY-MM-DD
  labs: ParsedLab[];
};

/**
 * Sinônimos/abreviações usados por laboratórios e médicos → chave do exame.
 * Texto é comparado sem acento. Exames urinários ambíguos (microalbuminúria,
 * albuminúria 24h, RAC vs concentração) ficam em `lab-urinary.ts`.
 */
const SYNONYMS: Record<string, string> = {
  // Função renal
  creatinina: "creatinina",
  creat: "creatinina",
  cr: "creatinina",
  ureia: "ureia",
  urea: "ureia",
  u: "ureia",
  tfge: "tfge",
  tfg: "tfge",
  egfr: "tfge",
  "ckd-epi": "tfge",
  "cistatina c": "cistatina_c",
  cistatina: "cistatina_c",
  // Eletrólitos e minerais
  potassio: "potassio",
  k: "potassio",
  sodio: "sodio",
  na: "sodio",
  cloro: "cloro",
  cl: "cloro",
  "calcio ionico": "calcio_ionico",
  calcio: "calcio",
  ca: "calcio",
  fosforo: "fosforo",
  fosfato: "fosforo",
  p: "fosforo",
  magnesio: "magnesio",
  mg: "magnesio",
  bicarbonato: "bicarbonato",
  hco3: "bicarbonato",
  // Metabólico
  hba1c: "hba1c",
  a1c: "hba1c",
  "hemoglobina glicada": "hba1c",
  "glicemia de jejum": "glicemia_jejum",
  "glicemia jejum": "glicemia_jejum",
  glicemia: "glicemia",
  glicose: "glicemia",
  "acido urico": "acido_urico",
  urato: "acido_urico",
  // Hemograma / anemia
  hemoglobina: "hemoglobina",
  hb: "hemoglobina",
  hematocrito: "hematocrito",
  ht: "hematocrito",
  hto: "hematocrito",
  leucocitos: "leucocitos",
  leuco: "leucocitos",
  plaquetas: "plaquetas",
  plaqueta: "plaquetas",
  plt: "plaquetas",
  plq: "plaquetas",
  ferritina: "ferritina",
  "saturacao de transferrina": "sat_transferrina",
  "sat transferrina": "sat_transferrina",
  ist: "sat_transferrina",
  "ferro serico": "ferro_serico",
  ferro: "ferro_serico",
  // Proteínas séricas / paratormônio
  pth: "pth",
  paratormonio: "pth",
  albumina: "albumina",
  "proteinas totais": "proteinas_totais",
  // Relações urinárias inequívocas (backup; o extrator urinário tem prioridade)
  rac: "rac",
  uacr: "rac",
  acr: "rac",
  "relacao albumina/creatinina": "rac",
  "albumina/creatinina": "rac",
  rpc: "rpc",
  "relacao proteina/creatinina": "rpc",
  "proteina/creatinina": "rpc",
  "proteinuria de 24 horas": "proteinuria_24h",
  "proteinuria de 24h": "proteinuria_24h",
  "proteinuria 24h": "proteinuria_24h",
  "proteinuria 24 h": "proteinuria_24h",
  // Lipídeos
  "colesterol total": "colesterol_total",
  ldl: "ldl",
  hdl: "hdl",
  triglicerideos: "triglicerideos",
  tg: "triglicerideos",
  // Hepático
  tgo: "tgo",
  ast: "tgo",
  tgp: "tgp",
  alt: "tgp",
  "gama-gt": "ggt",
  "gama gt": "ggt",
  ggt: "ggt",
  "fosfatase alcalina": "fosfatase_alcalina",
  // Tireoide / vitaminas / inflamatório / coagulação
  tsh: "tsh",
  "t4 livre": "t4_livre",
  t4l: "t4_livre",
  "vitamina d": "vitamina_d",
  "25-oh": "vitamina_d",
  "vitamina b12": "vitamina_b12",
  b12: "vitamina_b12",
  pcr: "pcr",
  "proteina c reativa": "pcr",
  vhs: "vhs",
  inr: "inr",
  rni: "inr",
};

const VALID_KEYS = new Set(NEPHRO_LABS.map((l) => l.key));
const SYNONYMS_FOLDED: Record<string, string> = {};
for (const [k, v] of Object.entries(SYNONYMS)) {
  SYNONYMS_FOLDED[foldLabText(k)] = v;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORTED_SYNONYMS = Object.keys(SYNONYMS_FOLDED).sort((a, b) => b.length - a.length);
const ALTERNATION = SORTED_SYNONYMS.map(escapeRe).join("|");

// LABEL + preenchimento de laudo (pontos, dois-pontos) + número BR
const LAB_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${ALTERNATION})[\\s:=\\-–—._]*${LAB_NUMBER_RE.source}`,
  "giu"
);

const DATE_RE = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/;
const DATE_RE_G = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g;

function toIsoDate(match: RegExpMatchArray): string | undefined {
  const [, d, m, yRaw] = match;
  if (yRaw.length !== 2 && yRaw.length !== 4) return undefined;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const yr = Number(y);
  if (yr < 1990 || yr > 2099) return undefined;
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  const day = Number(dd);
  const mon = Number(mm);
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return undefined;
  return `${y}-${mm}-${dd}`;
}

function overlaps(a: { start: number; end: number }, start: number, end: number): boolean {
  return a.start < end && start < a.end;
}

/** Extrai os exames de UM trecho de texto, mantendo a 1ª ocorrência de cada exame nele. */
function extractLabs(text: string): ParsedLab[] {
  const folded = foldLabText(text);
  const urinary = extractUrinaryLabs(text);
  const seen = new Set(urinary.labs.map((l) => l.testKey));
  const occupied = [...urinary.occupied];
  const labs: ParsedLab[] = urinary.labs.map((l) => ({ ...l }));

  for (const m of folded.matchAll(LAB_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (occupied.some((o) => overlaps(o, start, end))) continue;

    const rawLabel = foldLabText(m[1]);
    const testKey = SYNONYMS_FOLDED[rawLabel];
    if (!testKey || !VALID_KEYS.has(testKey) || seen.has(testKey)) continue;

    // "mg/g de creatinina" é unidade da RAC, não creatinina sérica.
    const before = folded.slice(Math.max(0, start - 16), start);
    if (testKey === "creatinina" && /\/\s*(?:g|mg)\s+de\s+$/.test(before)) continue;

    const value = parsePtBrLabNumber(m[2]);
    if (!Number.isFinite(value)) continue;

    let finalValue = value;
    const after = folded.slice(end, end + 16);
    if (/\s*mil\b/i.test(after) && (testKey === "plaquetas" || testKey === "leucocitos") && finalValue < 10000) {
      finalValue *= 1000;
    }

    seen.add(testKey);
    occupied.push({ start, end });
    const def = NEPHRO_LABS.find((l) => l.key === testKey)!;
    labs.push({ testKey, label: def.label, value: finalValue, unit: labUnit(testKey), raw: m[0].trim() });
  }
  return labs;
}

/**
 * Extrai resultados laboratoriais de texto livre (evolução, colagem de laudo, OCR).
 * Mantém apenas a primeira ocorrência de cada exame. (Compatível com o fluxo antigo.)
 */
export function parseLabsFromText(text: string): ParseResult {
  if (!text || !text.trim()) return { labs: [] };
  const dateMatch = text.match(DATE_RE);
  const date = dateMatch ? toIsoDate(dateMatch) : undefined;
  return { labs: extractLabs(text), date };
}

/**
 * Extrai exames AGRUPADOS por data. Reconhece VÁRIAS datas dentro do mesmo texto
 * (evolução/prontuário longo, colagem de laudo) e separa os resultados por data.
 *
 * Regra: cada data encontrada abre um bloco; os exames que vêm depois dela (até a
 * próxima data) pertencem a essa data. Exames antes da primeira data ficam sem data
 * (o médico confirma no modal). Blocos com a MESMA data são unidos.
 */
export function parseLabGroups(text: string): ParsedLabGroup[] {
  if (!text || !text.trim()) return [];

  const marks: { index: number; iso?: string }[] = [];
  for (const m of text.matchAll(DATE_RE_G)) {
    marks.push({ index: m.index ?? 0, iso: toIsoDate(m) });
  }

  if (marks.length === 0) {
    const labs = extractLabs(text);
    return labs.length ? [{ date: undefined, labs }] : [];
  }

  const groups: ParsedLabGroup[] = [];
  const pre = extractLabs(text.slice(0, marks[0].index));
  if (pre.length) groups.push({ date: undefined, labs: pre });

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const labs = extractLabs(text.slice(start, end));
    if (labs.length) groups.push({ date: marks[i].iso, labs });
  }

  const merged: ParsedLabGroup[] = [];
  for (const g of groups) {
    const key = g.date ?? "__none__";
    const existing = merged.find((x) => (x.date ?? "__none__") === key);
    if (!existing) {
      merged.push({ date: g.date, labs: [...g.labs] });
      continue;
    }
    for (const lab of g.labs) {
      if (!existing.labs.some((l) => l.testKey === lab.testKey)) existing.labs.push(lab);
    }
  }
  return merged;
}
