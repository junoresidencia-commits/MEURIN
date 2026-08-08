import { ESTAGIOS_G, CATEGORIAS_A } from "./clinical-fields";

/** Campo clínico detectado no texto da evolução (para confirmação do médico). */
export type DetectedField = { key: string; value: string };

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

/**
 * Extrai variáveis clínicas estruturadas do texto livre da evolução.
 * Conservador de propósito — o médico confirma tudo antes de salvar.
 */
export function extractClinicalFields(text: string): DetectedField[] {
  const t = norm(text || "");
  if (!t.trim()) return [];
  const out = new Map<string, string>();

  for (const r of TRI_RULES) {
    const v = tri(t, r.re);
    if (v) out.set(r.key, v);
  }

  // Estágio G (ex.: "G3b", "estágio 3b", "DRC G4")
  const g = /\b(?:drc\s*)?g\s?([1-5](?:a|b)?)\b/.exec(t) || /estagio\s*([1-5](?:a|b)?)/.exec(t);
  if (g) {
    const val = "G" + g[1]; // t já está minúsculo → "G3b", "G4"
    if ((ESTAGIOS_G as readonly string[]).includes(val)) out.set("estagio_g", val);
  }

  // Categoria de albuminúria (A1/A2/A3)
  const a = /\b(?:albuminuria\s*)?a([1-3])\b/.exec(t);
  if (a) {
    const val = "A" + a[1];
    if ((CATEGORIAS_A as readonly string[]).includes(val)) out.set("categoria_a", val);
  }

  // Etiologia principal
  for (const r of ETIOLOGIA_RULES) {
    if (r.re.test(t)) {
      out.set("etiologia_principal", r.value);
      break;
    }
  }

  // Tempo de diabetes (ex.: "DM2 há 15 anos", "diabetes há 10 anos")
  const dmYears =
    /(?:dm2?|diabet\w*)[^.\n;]{0,25}?(\d{1,2})\s*anos/.exec(t) ||
    /(\d{1,2})\s*anos[^.\n;]{0,20}?(?:de\s+)?(?:dm2?|diabet)/.exec(t);
  if (dmYears) out.set("tempo_dm_anos", dmYears[1]);

  return Array.from(out.entries()).map(([key, value]) => ({ key, value }));
}
