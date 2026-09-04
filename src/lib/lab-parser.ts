import { NEPHRO_LABS, labUnit } from "./labs";

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
 * Chaves multi-palavra vêm antes das curtas (a ordenação por tamanho garante isso).
 */
const SYNONYMS: Record<string, string> = {
  // Função renal
  creatinina: "creatinina",
  creat: "creatinina",
  cr: "creatinina",
  ureia: "ureia",
  "u\u00e9ia": "ureia",
  urea: "ureia",
  u: "ureia",
  tfge: "tfge",
  tfg: "tfge",
  egfr: "tfge",
  "ckd-epi": "tfge",
  "cistatina c": "cistatina_c",
  cistatina: "cistatina_c",
  // Eletrólitos e minerais
  "pot\u00e1ssio": "potassio",
  potassio: "potassio",
  k: "potassio",
  "s\u00f3dio": "sodio",
  sodio: "sodio",
  na: "sodio",
  cloro: "cloro",
  cl: "cloro",
  "c\u00e1lcio i\u00f4nico": "calcio_ionico",
  "calcio ionico": "calcio_ionico",
  "c\u00e1lcio": "calcio",
  calcio: "calcio",
  ca: "calcio",
  "f\u00f3sforo": "fosforo",
  fosforo: "fosforo",
  fosfato: "fosforo",
  p: "fosforo",
  "magn\u00e9sio": "magnesio",
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
  "\u00e1cido \u00farico": "acido_urico",
  "acido urico": "acido_urico",
  urato: "acido_urico",
  // Hemograma / anemia
  hemoglobina: "hemoglobina",
  hb: "hemoglobina",
  "hemat\u00f3crito": "hematocrito",
  hematocrito: "hematocrito",
  ht: "hematocrito",
  hto: "hematocrito",
  leucocitos: "leucocitos",
  "leuc\u00f3citos": "leucocitos",
  leuco: "leucocitos",
  plaquetas: "plaquetas",
  plaqueta: "plaquetas",
  ferritina: "ferritina",
  "satura\u00e7\u00e3o de transferrina": "sat_transferrina",
  "saturacao de transferrina": "sat_transferrina",
  "sat transferrina": "sat_transferrina",
  ist: "sat_transferrina",
  "ferro s\u00e9rico": "ferro_serico",
  "ferro serico": "ferro_serico",
  ferro: "ferro_serico",
  // Proteínas / paratormônio
  pth: "pth",
  paratormonio: "pth",
  albumina: "albumina",
  "prote\u00ednas totais": "proteinas_totais",
  "proteinas totais": "proteinas_totais",
  // Relações urinárias
  rac: "rac",
  "rela\u00e7\u00e3o albumina/creatinina": "rac",
  "albumina/creatinina": "rac",
  rpc: "rpc",
  "rela\u00e7\u00e3o prote\u00edna/creatinina": "rpc",
  "proteina/creatinina": "rpc",
  "proteinuria de 24h": "proteinuria_24h",
  "proteinuria 24h": "proteinuria_24h",
  microalbuminuria: "microalbuminuria",
  // Lipídeos
  "colesterol total": "colesterol_total",
  ldl: "ldl",
  hdl: "hdl",
  "triglicer\u00eddeos": "triglicerideos",
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
  "prote\u00edna c reativa": "pcr",
  vhs: "vhs",
  inr: "inr",
  rni: "inr",
};

const VALID_KEYS = new Set(NEPHRO_LABS.map((l) => l.key));

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Sinônimos ordenados do mais longo para o mais curto (evita casar "ca" antes de "cálcio iônico").
const SORTED_SYNONYMS = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);
const ALTERNATION = SORTED_SYNONYMS.map(escapeRe).join("|");

// (delimitador não-alfanumérico) LABEL (sep opcional) [comparador] NÚMERO
const LAB_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${ALTERNATION})\\s*[:=\\-]?\\s*([<>]?\\s*\\d{1,6}(?:[.,]\\d{1,3})?)`,
  "giu"
);

const DATE_RE = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/;
const DATE_RE_G = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g;

function toIsoDate(match: RegExpMatchArray): string | undefined {
  const [, d, m, yRaw] = match;
  if (yRaw.length !== 2 && yRaw.length !== 4) return undefined; // evita "1/2/3"
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const yr = Number(y);
  if (yr < 1990 || yr > 2099) return undefined; // sanidade: ignora números soltos
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  const day = Number(dd);
  const mon = Number(mm);
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return undefined;
  return `${y}-${mm}-${dd}`;
}

/** Extrai os exames de UM trecho de texto, mantendo a 1ª ocorrência de cada exame nele. */
function extractLabs(text: string): ParsedLab[] {
  const seen = new Set<string>();
  const labs: ParsedLab[] = [];
  for (const m of text.matchAll(LAB_RE)) {
    const rawLabel = m[1].toLowerCase();
    const testKey = SYNONYMS[rawLabel];
    if (!testKey || !VALID_KEYS.has(testKey) || seen.has(testKey)) continue;

    const numRaw = m[2].replace(/[<>\s]/g, "").replace(",", ".");
    const value = Number(numRaw);
    if (!Number.isFinite(value)) continue;

    seen.add(testKey);
    const def = NEPHRO_LABS.find((l) => l.key === testKey)!;
    labs.push({ testKey, label: def.label, value, unit: labUnit(testKey), raw: m[0].trim() });
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

  // Une blocos com a MESMA data (mantém a 1ª ocorrência de cada exame).
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
