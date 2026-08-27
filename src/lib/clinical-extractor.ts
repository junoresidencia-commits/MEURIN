import { ESTAGIOS_G, CATEGORIAS_A } from "./clinical-fields";

/** Campo clínico detectado no texto da evolução (para confirmação do médico). */
export type DetectedField = { key: string; value: string };

/** Campos de DRC com estágio explícito: o médico já escreveu, não precisa escolher 1/2/3/4. */
export const AUTO_SAVE_CLINICAL_KEYS = new Set(["drc", "estagio_g", "categoria_a"]);

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Detecta presença (sim) ou negação (não) de um termo. Retorna null se ausente. */
function tri(text: string, re: RegExp): "sim" | "nao" | null {
  const m = re.exec(text);
  if (!m) return null;
  const pre = text.slice(Math.max(0, m.index - 22), m.index);
  return /\b(nega|nego|sem|ausencia|ausente|nao|nunca)\b/.test(pre) ? "nao" : "sim";
}

const TRI_RULES: { key: string; re: RegExp }[] = [
  { key: "drc", re: /\b(drc|irc|doenca renal cronica|insuficiencia renal cronica)\b/ },
  { key: "has", re: /\b(has|hipertens)/ },
  { key: "dm", re: /\b(dm2?|diabet)/ },
  { key: "ic", re: /\b(insuficiencia cardiaca|icc?)\b/ },
  { key: "dcv", re: /(doenca cardiovascular|coronariopat|infarto|iam|avc|dac)\b/ },
  { key: "obesidade", re: /\b(obesidade|obeso|obesa)\b/ },
  { key: "dislipidemia", re: /\b(dislipidemia|hipercolesterolemia)\b/ },
  { key: "hepatopatia", re: /\b(hepatopatia|cirrose|doenca hepatica)\b/ },
  { key: "neoplasia", re: /\b(neoplasia|cancer|ca de|tumor|neoplasico)\b/ },
  { key: "tabagismo", re: /\b(tabagis|tabagista|fumante|fuma\b)/ },
  { key: "rim_unico", re: /\b(rim unico|monorrim)\b/ },
  { key: "litiase", re: /\b(litiase|nefrolitiase|calculo renal|calculos renais|urolitiase)\b/ },
  { key: "transplante", re: /\b(transplant)/ },
  { key: "hemodialise", re: /\b(hemodialise|hemodialitico|em hd)\b/ },
  { key: "dialise_peritoneal", re: /\b(dialise peritoneal|capd|dpac)\b/ },
  { key: "ira_previa", re: /\b(injuria renal aguda|insuficiencia renal aguda|\bira\b)\b/ },
  { key: "glomerulopatia", re: /\b(glomerulopatia|glomerulonefrite|gesf|nefropatia por iga|nefropatia membranosa)\b/ },
  { key: "policistica", re: /\b(policistic|rins policisticos|drpa)\b/ },
];

const ETIOLOGIA_RULES: { value: string; re: RegExp }[] = [
  { value: "doenca_renal_diabetica", re: /(nefropatia diabetica|doenca renal diabetica|nefropatia do diabetes)/ },
  { value: "nefroesclerose_hipertensiva", re: /(nefroesclerose hipertensiva|nefropatia hipertensiva)/ },
  { value: "glomerulopatia", re: /(glomerulopatia|glomerulonefrite|gesf|nefropatia por iga|nefropatia membranosa)/ },
  { value: "doenca_renal_policistica", re: /(rim policistic|doenca renal policistica|drpa)/ },
  { value: "uropatia_obstrutiva", re: /(uropatia obstrutiva|obstrucao urinaria)/ },
  { value: "nefropatia_tubulointersticial", re: /(tubulointersticial|nefrite intersticial)/ },
  { value: "doenca_autoimune", re: /(lupus|nefrite lupica|vasculite|autoimune)/ },
];

/** Token de estágio: 3, 3a, G4, III, IIIA, iv… */
const STAGE_TOKEN = "(?:g\\s*)?(?:iiia|iiib|iii|iia|iib|ii|iva|ivb|iv|va|vb|v|ia|ib|i|[1-5][ab]?)";

function tokenToG(raw: string): string | null {
  const t = raw.toLowerCase().replace(/\s+/g, "").replace(/^g/, "");
  const roman: Record<string, string> = {
    i: "G1", ia: "G1", ib: "G1",
    ii: "G2", iia: "G2", iib: "G2",
    iii: "G3", iiia: "G3a", iiib: "G3b",
    iv: "G4", iva: "G4", ivb: "G4",
    v: "G5", va: "G5", vb: "G5",
  };
  if (roman[t]) return roman[t];
  const m = /^([1-5])([ab])?$/.exec(t);
  if (!m) return null;
  const val = m[1] === "3" && !m[2] ? "G3" : `G${m[1]}${m[2] || ""}`;
  return (ESTAGIOS_G as readonly string[]).includes(val) ? val : null;
}

function looksLikeDoseOrTime(t: string, index: number, matchLen: number): boolean {
  const after = t.slice(index + matchLen, index + matchLen + 16);
  if (/\s*(mg|mcg|ug|anos?|meses|semanas|dias|x\/|vez|comp|cp\b|ui\b)/.test(after)) return true;
  const pre = t.slice(Math.max(0, index - 10), index);
  return /\b(ha|apos|faz)\s*$/.test(pre);
}

function extractEstagioG(t: string): string | null {
  const patterns = [
    // DRC/CKD + número ou romano (ex.: "DRC 3", "Drc III", "DRC G3a")
    new RegExp(`\\b(?:drc|irc|ckd)(?:\\s+estagio)?\\s*(${STAGE_TOKEN})\\b`, "g"),
    // "estágio 3", "estágio III", "estágio G4"
    new RegExp(`\\bestagio\\s*(${STAGE_TOKEN})\\b`, "g"),
    // "G3b", "G4", "g 3a"
    /\b(?:drc\s*)?g\s?([1-5](?:a|b)?)\b/g,
  ];
  for (const re of patterns) {
    for (const m of t.matchAll(re)) {
      if (looksLikeDoseOrTime(t, m.index ?? 0, m[0].length)) continue;
      const val = tokenToG(m[1]);
      if (val) return val;
    }
  }
  return null;
}

function extractCategoriaA(t: string): string | null {
  const m =
    /\b(?:albuminuria\s*)?a\s*([1-3])\b/.exec(t) ||
    /\bcategoria\s*a\s*([1-3])\b/.exec(t);
  if (!m) return null;
  const val = "A" + m[1];
  return (CATEGORIAS_A as readonly string[]).includes(val) ? val : null;
}

/**
 * Extrai variáveis clínicas estruturadas do texto livre da evolução.
 * DRC com estágio (arábico ou romano) é alta confiança — o médico já escreveu o número.
 */
export function extractClinicalFields(text: string): DetectedField[] {
  const t = norm(text || "");
  if (!t.trim()) return [];
  const out = new Map<string, string>();

  for (const r of TRI_RULES) {
    const v = tri(t, r.re);
    if (v) out.set(r.key, v);
  }

  const g = extractEstagioG(t);
  if (g) {
    out.set("estagio_g", g);
    if (!out.has("drc")) out.set("drc", "sim");
  }

  const a = extractCategoriaA(t);
  if (a) out.set("categoria_a", a);

  for (const r of ETIOLOGIA_RULES) {
    if (r.re.test(t)) {
      out.set("etiologia_principal", r.value);
      break;
    }
  }

  const dmYears =
    /(?:dm2?|diabet\w*)[^.\n;]{0,25}?(\d{1,2})\s*anos/.exec(t) ||
    /(\d{1,2})\s*anos[^.\n;]{0,20}?(?:de\s+)?(?:dm2?|diabet)/.exec(t);
  if (dmYears) out.set("tempo_dm_anos", dmYears[1]);

  return Array.from(out.entries()).map(([key, value]) => ({ key, value }));
}

export function formatDrcSummary(fields: DetectedField[]): string {
  const map = new Map(fields.map((f) => [f.key, f.value]));
  if (!map.has("drc") && !map.has("estagio_g")) return "";
  const g = map.get("estagio_g");
  const a = map.get("categoria_a");
  return ["DRC", g, a].filter(Boolean).join(" ");
}
