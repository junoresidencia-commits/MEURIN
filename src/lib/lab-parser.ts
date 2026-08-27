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
  plaquetas: "plaquetas",
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
const DATE_DMY_G = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g;
const DATE_ISO_G = /(\d{4})-(\d{2})-(\d{2})/g;
const MONTHS: Record<string, string> = {
  janeiro: "01", jan: "01",
  fevereiro: "02", fev: "02",
  marco: "03", março: "03", mar: "03",
  abril: "04", abr: "04",
  maio: "05", mai: "05",
  junho: "06", jun: "06",
  julho: "07", jul: "07",
  agosto: "08", ago: "08",
  setembro: "09", set: "09",
  outubro: "10", out: "10",
  novembro: "11", nov: "11",
  dezembro: "12", dez: "12",
};
const DATE_PT_G = /(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(?:de\s+)?(\d{4})/gi;

const IGNORE_DATE_BEFORE = /\b(retorno|retornar|consulta|agendar|agendad|proxima|próxima|comparec|versus|\bvs\b|comparad|desde|a partir)/i;

function toIsoDate(dRaw: string, mRaw: string, yRaw: string): string | undefined {
  if (yRaw.length !== 2 && yRaw.length !== 4) return undefined;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const yr = Number(y);
  if (yr < 1990 || yr > 2099) return undefined;
  const dd = dRaw.padStart(2, "0");
  const mm = mRaw.padStart(2, "0");
  const day = Number(dd);
  const mon = Number(mm);
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return undefined;
  return `${y}-${mm}-${dd}`;
}

function dateIgnoredAt(text: string, index: number): boolean {
  const pre = text.slice(Math.max(0, index - 28), index);
  return IGNORE_DATE_BEFORE.test(pre);
}

type DateMark = { index: number; iso?: string; length: number };

function collectDateMarks(text: string): DateMark[] {
  const marks: DateMark[] = [];
  for (const m of text.matchAll(DATE_DMY_G)) {
    if (dateIgnoredAt(text, m.index ?? 0)) continue;
    marks.push({ index: m.index ?? 0, iso: toIsoDate(m[1], m[2], m[3]), length: m[0].length });
  }
  for (const m of text.matchAll(DATE_ISO_G)) {
    if (dateIgnoredAt(text, m.index ?? 0)) continue;
    marks.push({ index: m.index ?? 0, iso: toIsoDate(m[3], m[2], m[1]), length: m[0].length });
  }
  for (const m of text.matchAll(DATE_PT_G)) {
    if (dateIgnoredAt(text, m.index ?? 0)) continue;
    const month = MONTHS[m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    marks.push({ index: m.index ?? 0, iso: toIsoDate(m[1], month, m[3]), length: m[0].length });
  }
  marks.sort((a, b) => a.index - b.index);
  const dedup: DateMark[] = [];
  for (const mark of marks) {
    const prev = dedup[dedup.length - 1];
    if (prev && mark.index < prev.index + prev.length) continue;
    dedup.push(mark);
  }
  return dedup;
}

const UNIT_FALSE_POS = new Set(["mg", "mcg", "g", "ml", "ui", "p", "k", "na", "ca", "cl", "cr", "ht"]);

/** Extrai os exames de UM trecho de texto, mantendo a 1ª ocorrência de cada exame nele. */
function extractLabs(text: string): ParsedLab[] {
  const seen = new Set<string>();
  const labs: ParsedLab[] = [];
  for (const m of text.matchAll(LAB_RE)) {
    const rawLabel = m[1].toLowerCase();
    const testKey = SYNONYMS[rawLabel];
    if (!testKey || !VALID_KEYS.has(testKey) || seen.has(testKey)) continue;

    // "50 mg 1x/dia" não é magnésio: o rótulo curto veio depois de um número (unidade/dose).
    const pre = text.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    if (UNIT_FALSE_POS.has(rawLabel) && /\d\s*$/.test(pre)) continue;

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
  const date = dateMatch ? toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]) : collectDateMarks(text)[0]?.iso;
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
/**
 * Extrai exames AGRUPADOS por data. Reconhece VÁRIAS datas dentro do mesmo texto
 * (evolução/prontuário longo, colagem de laudo) e separa os resultados por data.
 *
 * Regras (para não jogar o exame na data errada):
 * - data no começo ou no fim da mesma linha vale para os exames daquela linha;
 * - linha só com data vira cabeçalho dos exames das linhas seguintes;
 * - datas de retorno/consulta/agendamento são ignoradas.
 */
export function parseLabGroups(text: string): ParsedLabGroup[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  let currentDate: string | undefined;
  const buckets: { date?: string; labs: ParsedLab[] }[] = [];

  function add(date: string | undefined, labs: ParsedLab[]) {
    if (!labs.length) return;
    const key = date ?? "__none__";
    const existing = buckets.find((b) => (b.date ?? "__none__") === key);
    if (!existing) {
      buckets.push({ date, labs: [...labs] });
      return;
    }
    for (const lab of labs) {
      if (!existing.labs.some((l) => l.testKey === lab.testKey)) existing.labs.push(lab);
    }
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const marks = collectDateMarks(line);
    const labs = extractLabs(line);
    if (marks.length && labs.length) {
      const first = marks[0];
      const last = marks[marks.length - 1];
      const dateAtStart = first.index <= 2 || !extractLabs(line.slice(0, first.index)).length;
      const iso = (dateAtStart ? first.iso : last.iso) || currentDate;
      add(iso, labs);
      if (iso) currentDate = iso;
    } else if (marks.length && !labs.length) {
      const iso = marks[0].iso;
      if (iso) currentDate = iso;
    } else if (labs.length) {
      add(currentDate, labs);
    }
  }

  // Texto sem quebras de linha: cai no algoritmo antigo por posição, mas com datas ignoradas.
  if (buckets.length === 0 && !text.includes("\n")) {
    const marks = collectDateMarks(text);
    if (marks.length === 0) {
      const labs = extractLabs(text);
      return labs.length ? [{ date: undefined, labs }] : [];
    }
    const pre = extractLabs(text.slice(0, marks[0].index));
    // Exames na mesma linha *antes* da 1ª data pertencem a essa data (não ficam "sem data").
    if (pre.length) add(marks[0].iso, pre);
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].index;
      const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
      add(marks[i].iso, extractLabs(text.slice(start, end)));
    }
  }

  return buckets.filter((b) => b.labs.length);
}
