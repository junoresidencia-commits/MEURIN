/** Extração conservadora de medicamentos a partir da evolução (o médico confirma). */

export type ParsedMed = {
  name: string;
  dose?: string;
  freq?: string;
  raw: string;
};

const KNOWN = [
  "losartana", "enalapril", "captopril", "ramipril", "anlodipino", "amlodipino",
  "nifedipino", "hidroclorotiazida", "hctz", "furosemida", "espironolactona",
  "chlortalidona", "clortalidona", "dapagliflozina", "empagliflozina", "canagliflozina",
  "metformina", "insulina", "glifage", "sinvastatina", "atorvastatina", "rosuvastatina",
  "aas", "acido acetilsalicilico", "clopidogrel", "omeprazol", "pantoprazol",
  "allopurinol", "alopurinol", "febuxostate", "carbonato de calcio",
  "calcitriol", "paricalcitol", "cinacalcete", "sevelamer", "lanthano",
  "eritropoetina", "alfaepoetina", "darbepoetina", "sacarato de hidroxido ferrico",
  "bicarbonato de sodio", "poliestireno", "sorcal", "prednisona", "prednisolona",
  "micofenolato", "tacrolimo", "ciclosporina", "everolimo",
  "varfarina", "rivaroxabana", "apixabana",
  "sertralina", "fluoxetina", "clonazepam",
  "levotiroxina",
  "nitrofurantoina", "ciprofloxacino", "amoxicilina",
];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const FREQ_RE = /(\d+\s*[xX](?:\s*\/?\s*(?:dia|d|semana|sem))?|(?:1|2|3|4)\s*vez(?:es)?\s*(?:ao|por)?\s*dia|12\/12h|8\/8h|6\/6h|24\/24h|uso continuo|uso contínuo)/i;
const DOSE_RE = /(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ui|u\.?i\.?|ml|g|%|mcg\/kg))/i;

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseLine(rawLine: string, inBlock = false): ParsedMed | null {
  const line = rawLine.replace(/^[\s\-•*\d.)]+/, "").trim();
  if (line.length < 3 || line.length > 180) return null;
  const n0 = norm(line);
  if (/^(medicamentos?|em uso|manter|prescricao|posologia|orientac)\s*:?\s*$/.test(n0)) return null;

  const cleaned = line.replace(/^(manter|iniciar|introduzir|suspender|continuar)\s+/i, "").trim();
  const n = norm(cleaned);
  const known = KNOWN.find((k) => new RegExp(`(?:^|\\b)${k.replace(/ /g, "\\s+")}\\b`).test(n));
  const doseM = cleaned.match(DOSE_RE);
  const freqM = cleaned.match(FREQ_RE);

  if (known) {
    if (!inBlock && !doseM) return null;
    const name = titleCase(known === "hctz" ? "Hidroclorotiazida" : known === "aas" ? "AAS" : known);
    return { name, dose: doseM?.[1], freq: freqM?.[1], raw: cleaned };
  }

  // Genérico: palavra capitalizada + dose (ex.: "Telmisartana 40 mg 1x/dia")
  if (doseM) {
    const before = cleaned.slice(0, doseM.index).replace(/[,:;]+$/, "").trim();
    const name = before.replace(/^(manter|iniciar|introduzir|suspender)\s+/i, "").trim();
    if (name.split(/\s+/).length <= 5 && /[A-Za-zÀ-ÿ]{4,}/.test(name) && !/\d/.test(name)) {
      return { name: titleCase(name), dose: doseM[1], freq: freqM?.[1], raw: cleaned };
    }
  }
  return null;
}

function keyOf(m: ParsedMed): string {
  return norm(`${m.name}|${m.dose || ""}`);
}

/** Lista já estruturada (campo "medicamentos em uso"), uma por linha. */
export function parseMedsList(text: string): ParsedMed[] {
  if (!text?.trim()) return [];
  const out: ParsedMed[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n|;/)) {
    const parsed = parseLine(line) || (line.trim().length >= 3 ? { name: line.trim(), raw: line.trim() } : null);
    if (!parsed) continue;
    const k = keyOf(parsed);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(parsed);
  }
  return out;
}

function partsOf(line: string): string[] {
  const chunks = line.split(/\s*;\s*|\s+e\s+/i).map((s) => s.trim()).filter(Boolean);
  return chunks.length ? chunks : [line];
}

/**
 * Detecta medicamentos na evolução (linhas de "em uso", "medicações", ou nomes conhecidos + dose).
 */
export function extractMedsFromText(text: string): ParsedMed[] {
  if (!text?.trim()) return [];
  const lines = text.split(/\r?\n/);
  const out: ParsedMed[] = [];
  const seen = new Set<string>();
  let inBlock = false;

  const push = (m: ParsedMed | null) => {
    if (!m) return;
    const k = keyOf(m);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };

  for (const line of lines) {
    const n = norm(line);
    if (/\b(medicacoes|medicamentos|em uso|manter:|prescricao atual|prescrição atual)\b/.test(n)) {
      inBlock = true;
      const after = line.split(/:|–|-/).slice(1).join(":").trim();
      if (after) after.split(/;|,/).forEach((part) => push(parseLine(part, true)));
      continue;
    }
    if (inBlock && !line.trim()) {
      inBlock = false;
      continue;
    }
    if (inBlock) {
      partsOf(line).forEach((part) => push(parseLine(part, true)));
      continue;
    }
    partsOf(line).forEach((part) => push(parseLine(part)));
  }
  return out;
}

export function mergeMeds(a: ParsedMed[], b: ParsedMed[]): ParsedMed[] {
  const seen = new Set<string>();
  const out: ParsedMed[] = [];
  for (const m of [...a, ...b]) {
    const k = keyOf(m);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

export function formatMedLine(m: ParsedMed): string {
  return [m.name, m.dose, m.freq].filter(Boolean).join(" — ");
}

export function medsToProfileText(meds: ParsedMed[]): string {
  return meds.map(formatMedLine).join("\n");
}

export function medsToReceitaBody(meds: ParsedMed[]): string {
  if (!meds.length) return "";
  const lines: string[] = [];
  meds.forEach((m, i) => {
    lines.push(`${i + 1}. ${m.name}${m.dose ? ` ${m.dose}` : ""}`);
    lines.push(`   Posologia: ${m.freq || "____"} — via oral — uso contínuo (revisar)`);
    lines.push("   Quantidade: ____");
    lines.push("");
  });
  lines.push("Orientações: ");
  return lines.join("\n").trim();
}

export function labsToExameBody(labels: string[], dateLabel?: string): string {
  const head = dateLabel
    ? `Repetir os exames da coleta de ${dateLabel}:`
    : "Repetir os exames abaixo:";
  return [head, "", ...labels.map((l) => `- ${l}`)].join("\n");
}
