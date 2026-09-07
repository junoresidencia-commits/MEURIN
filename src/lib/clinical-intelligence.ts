/**
 * Extração clínica da evolução: contexto, confiança e perfil.
 * Conservador — familiar / suspeita / baixa confiança não viram diagnóstico confirmado.
 */

import { CATEGORIAS_A, CLINICAL_FIELDS, ESTAGIOS_G } from "./clinical-fields";
import { aFromRac, canConfirmDrc, gFromEgfr, hasChronicReducedEgfr, refineG } from "./kdigo";
import { parseLabGroups } from "./lab-parser";
import { termsByAliasLength } from "./medical-terms";

export type IntelStatus =
  | "confirmado"
  | "provavel"
  | "suspeito"
  | "negado"
  | "familiar"
  | "resolvido"
  | "antecedente";

export type IntelConfidence = "alta" | "media" | "baixa";

export type DetectedField = {
  key: string;
  value: string;
  label?: string;
  status?: IntelStatus;
  confidence?: IntelConfidence;
  autoApply?: boolean;
  evidence?: string;
};

const FIELD_LABEL = new Map(CLINICAL_FIELDS.map((f) => [f.key, f.label]));

export function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function labelOf(key: string, fallback?: string): string {
  return FIELD_LABEL.get(key) || fallback || key;
}

function push(
  out: Map<string, DetectedField>,
  item: DetectedField
) {
  const prev = out.get(item.key);
  const rank = (c?: IntelConfidence) => (c === "alta" ? 3 : c === "media" ? 2 : 1);
  if (prev && rank(prev.confidence) > rank(item.confidence)) return;
  if (prev && prev.status === "negado" && item.status !== "negado") return;
  out.set(item.key, {
    ...item,
    label: item.label || labelOf(item.key),
    autoApply:
      item.autoApply ??
      (item.confidence === "alta" &&
        (item.status === "confirmado" || item.status === "negado" || !item.status)),
  });
}

function windowOf(text: string, index: number, len: number) {
  return {
    pre: text.slice(Math.max(0, index - 80), index),
    post: text.slice(index, Math.min(text.length, index + len + 60)),
    clause: text.slice(Math.max(0, index - 80), Math.min(text.length, index + len + 80)),
  };
}

function statusAround(pre: string, post: string): IntelStatus {
  const left = pre.slice(-50);
  if (/\b(historia familiar|antecedente familiar|familiar de|mae com|pai com|irmao com|irma com|filho com)\b/.test(left + post.slice(0, 20))) {
    return "familiar";
  }
  if (/\b(suspeita(?:-se)? de|possivel|a esclarecer|investigar|hipotese de)\b/.test(left)) return "suspeito";
  if (/\b(resolvido|em remissao|curado|apos transplante pancreatico)\b/.test(left + " " + post)) return "resolvido";
  if (/\b(nega|nego|sem historia de|sem hx de|nunca teve|ausencia de|ausente)\b/.test(left)) return "negado";
  if (/\b(nega|nego)\s+[^.]*$/.test(left)) return "negado";
  return "confirmado";
}

function confidenceFor(status: IntelStatus, ambiguous: boolean): IntelConfidence {
  if (ambiguous) return "baixa";
  if (status === "familiar" || status === "suspeito" || status === "resolvido") return "baixa";
  if (status === "negado" || status === "confirmado") return "alta";
  return "media";
}

/** DRC G1–G5, romanos, "estágio 4", "DRC 3b". */
export function parseDrcStage(text: string): string | null {
  const t = norm(text);
  const roman: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };
  const patterns = [
    /\bdrc\s*g\s*([1-5](?:a|b)?)\b/,
    /\bg\s*([1-5](?:a|b)?)\b/,
    /\bdrc\s*estagio\s*([1-5](?:a|b)?)\b/,
    /\bdoenca renal(?: cronica)?\s*(?:estagio\s*)?([1-5](?:a|b)?)\b/,
    /\brenal cronico\s*g?\s*([1-5](?:a|b)?)\b/,
    /\bestagio\s*([1-5](?:a|b)?)\b/,
    /\bdrc\s*([1-5](?:a|b)?)\b/,
    /\bdrc\s*(iii|ii|iv|i|v)(a|b)?\b/,
    /\bestagio\s*(iii|ii|iv|i|v)\b/,
  ];
  if (/\b(?:sindrome\s*)?ckm\b/.test(t) && /estagio\s*[1-4]/.test(t) && !/\bdrc\b/.test(t)) {
    return null;
  }
  for (const re of patterns) {
    const m = re.exec(t);
    if (!m) continue;
    let n = m[1];
    if (roman[n]) n = roman[n] + (m[2] || "");
    const val = n.toUpperCase().startsWith("G") ? n.toUpperCase() : "G" + n;
    const canon = val.replace("G3A", "G3a").replace("G3B", "G3b");
    if (canon === "G3" || (ESTAGIOS_G as readonly string[]).includes(canon)) return canon;
  }
  return null;
}

function parseOccupation(t: string): string | null {
  const jobs = [
    "pedreiro", "motorista", "agricultor", "agricultora", "professor", "professora",
    "enfermeiro", "enfermeira", "medico", "medica", "comerciante", "aposentado",
    "aposentada", "do lar", "autonomo", "autonoma", "servidor publico", "costureira",
    "domestica", "pedagoga", "advogado", "advogada", "contador", "contadora",
  ];
  const named = /(?:profissao|trabalha como|ocupacao)\s*[:\-]?\s*([a-z ]{3,40}?)(?:[.,;]|$)/.exec(t);
  if (named) return named[1].trim();
  for (const j of jobs) {
    const re = new RegExp(`\\b${j}\\b`);
    if (re.test(t)) return j;
  }
  return null;
}

function parseSmoking(t: string, out: Map<string, DetectedField>) {
  const pack =
    /(\d+(?:[.,]\d+)?)\s*macos?\s*(?:\/|por)?\s*dia[^.\n]{0,20}?(\d{1,2})\s*anos/.exec(t) ||
    /fumou\s+(\d+(?:[.,]\d+)?)\s*macos?\s*(?:\/|por)?\s*dia\s+por\s+(\d{1,2})\s*anos/.exec(t);
  if (pack) {
    const macos = Number(pack[1].replace(",", "."));
    const anos = Number(pack[2]);
    if (Number.isFinite(macos) && Number.isFinite(anos)) {
      push(out, {
        key: "carga_tabagica",
        value: String(Math.round(macos * anos)),
        label: "Carga tabágica (anos-maço)",
        status: "confirmado",
        confidence: "alta",
        autoApply: true,
      });
    }
  }
  if (/\bex[-\s]?tabagista\b|\bparou de fumar\b|\bfumou\b[^.\n]{0,40}\bparou\b/.test(t)) {
    push(out, { key: "ex_tabagista", value: "sim", status: "confirmado", confidence: "alta", autoApply: true });
    push(out, { key: "tabagismo", value: "nao", status: "confirmado", confidence: "alta", autoApply: true });
    const cess = /parou ha (\d{1,2})\s*anos/.exec(t);
    if (cess) {
      push(out, {
        key: "tabagismo_cessacao_anos",
        value: cess[1],
        label: "Cessação do tabaco (anos)",
        status: "confirmado",
        confidence: "alta",
        autoApply: true,
      });
    }
    return;
  }
  if (/\b(nega tabagismo|nunca fumou|nao fumante)\b/.test(t)) {
    push(out, { key: "tabagismo", value: "nao", status: "negado", confidence: "alta", autoApply: true });
    return;
  }
  if (/\b(tabagista|fumante|fuma\b)\b/.test(t)) {
    push(out, { key: "tabagismo", value: "sim", status: "confirmado", confidence: "alta", autoApply: true });
  }
}

function parseAllergies(t: string, out: Map<string, DetectedField>) {
  if (/\b(nega alergias|sem alergias|nega alergia medicamentosa)\b/.test(t)) {
    push(out, { key: "alergias_negadas", value: "sim", label: "Nega alergias", status: "negado", confidence: "alta", autoApply: true });
    return;
  }
  const angio = /(?:teve\s+)?angioedema com ([a-z0-9 ]{3,40}?)(?:[.,;]|$)/.exec(t);
  if (angio) {
    push(out, {
      key: "alergias",
      value: `Angioedema com ${angio[1].trim()}`,
      status: "confirmado",
      confidence: "alta",
      autoApply: true,
    });
    return;
  }
  const al = /alergico a ([a-z0-9 ]{3,40}?)(?:[.,;]|$)/.exec(t) || /alergia a ([a-z0-9 ]{3,40}?)(?:[.,;]|$)/.exec(t);
  if (al) {
    push(out, { key: "alergias", value: al[1].trim(), status: "confirmado", confidence: "alta", autoApply: true });
  }
}

const DRUGS = [
  "losartana", "enalapril", "captopril", "valsartana", "telmisartana", "olmesartana",
  "anlodipino", "anlodipina", "amlodipina", "nifedipino", "hidroclorotiazida",
  "furosemida", "espironolactona", "eplerenona", "dapagliflozina", "empagliflozina",
  "canagliflozina", "metformina", "insulina", "atorvastatina", "sinvastatina",
  "rosuvastatina", "omeprazol", "pantoprazol", "aas", "acido acetilsalicilico",
  "clopidogrel", "apixabana", "rivaroxabana", "varfarina", "sevelamer",
  "calcitriol", "alopurinol", "allopurinol", "prednisona", "prednisolona",
  "carvedilol", "bisoprolol", "atenolol", "clonidina", "hidralazina",
].sort((a, b) => b.length - a.length);

function parseMeds(t: string, out: Map<string, DetectedField>) {
  const items: string[] = [];
  const suspended: string[] = [];
  for (const drug of DRUGS) {
    const re = new RegExp(
      `(suspendo|suspender|suspensa?)\\s+${drug}|${drug}\\s+(\\d+(?:[.,]\\d+)?)\\s*(mg|mcg|g|ui)?(?:\\s*(\\d{1,2}\\/\\d{1,2}h|1x\\/?dia|2x\\/?dia|ao dia|\\/dia|pela manha|12\\/12h))?`,
      "g"
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (m[1] && /suspend/.test(m[1])) {
        suspended.push(drug);
        continue;
      }
      const dose = [m[2], m[3], m[4]].filter(Boolean).join(" ");
      items.push(dose ? `${drug} ${dose}` : drug);
    }
  }
  if (items.length) {
    push(out, {
      key: "medicamentos_em_uso",
      value: items.join("; "),
      status: "confirmado",
      confidence: "alta",
      autoApply: true,
    });
  }
  if (suspended.length) {
    push(out, {
      key: "medicamentos_suspensos",
      value: suspended.join("; "),
      label: "Medicamentos suspensos",
      status: "confirmado",
      confidence: "alta",
      autoApply: true,
    });
  }
}

function parseEas(t: string, out: Map<string, DetectedField>) {
  const fitaMap = (raw: string): string | null => {
    const s = raw.replace(/\s+/g, "").toLowerCase();
    if (/negativ|ausente|0/.test(s)) return "negativo";
    if (/traco/.test(s)) return "tracos";
    if (s === "++++" || s === "4+") return "4+";
    if (s === "+++" || s === "3+") return "3+";
    if (s === "++" || s === "2+") return "2+";
    if (s === "+" || s === "1+") return "1+";
    return null;
  };
  const prot =
    /proteina(?:s)?(?:\s+urinaria)?\s*[:\-]?\s*(\+{1,4}|[1-4]\+|tracos?|negativ\w+|ausente)/.exec(t) ||
    /proteinuria\s*(?:qualitativa)?\s*[:\-]?\s*(\+{1,4}|[1-4]\+|tracos?|negativ\w+)/.exec(t);
  if (prot) {
    const v = fitaMap(prot[1]);
    if (v) {
      push(out, {
        key: "proteinuria_fita",
        value: v,
        status: "confirmado",
        confidence: "alta",
        autoApply: true,
        evidence: prot[0],
      });
    }
  }
  if (/\bhematuria negativa\b|\bhemacias\s*(negativ|ausente|0)\b/.test(t)) {
    push(out, { key: "hematuria_fita", value: "negativo", status: "confirmado", confidence: "alta", autoApply: true });
  } else {
    const hem = /(?:hemoglobina|hematuria|sangue)\s*[:\-]?\s*(\+{1,4}|[1-4]\+|tracos?|negativ\w+)/.exec(t);
    if (hem) {
      const v = fitaMap(hem[1]);
      if (v) push(out, { key: "hematuria_fita", value: v, status: "confirmado", confidence: "alta", autoApply: true });
    }
  }
  const leuco = /leucocitos?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:\/campo|\/c)?/.exec(t);
  if (leuco) {
    const n = Number(leuco[1].replace(",", "."));
    if (n > 5) {
      push(out, {
        key: "leucocituria",
        value: "sim",
        label: "Leucocitúria",
        status: "confirmado",
        confidence: "media",
        autoApply: false,
      });
    }
  }
  const nit = /nitrito\s*[:\-]?\s*(positivo|negativo|pos|neg)/.exec(t);
  if (nit) {
    push(out, {
      key: "nitrito_urinario",
      value: /pos/.test(nit[1]) ? "positivo" : "negativo",
      label: "Nitrito (EAS)",
      status: "confirmado",
      confidence: "alta",
      autoApply: true,
    });
  }
  const dens = /densidade\s*[:\-]?\s*(1[.,]\d{3})/.exec(t);
  if (dens) {
    push(out, {
      key: "densidade_urinaria",
      value: dens[1].replace(",", "."),
      label: "Densidade urinária",
      status: "confirmado",
      confidence: "alta",
      autoApply: true,
    });
  }
}

function parseBareIc(t: string, out: Map<string, DetectedField>) {
  if (out.has("ic")) return;
  const re = /\bic\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const { pre, post } = windowOf(t, m.index, 2);
    const nearby = (pre + post).slice(-40);
    const heart = /\b(cardiaca|congestiva|fracao|feve|icfer|icfep|icc)\b/.test(nearby);
    if (!heart) continue;
    const st = statusAround(pre, post);
    const conf = confidenceFor(st, false);
    push(out, {
      key: "ic",
      value: st === "negado" ? "nao" : "sim",
      status: st,
      confidence: conf,
      autoApply: conf === "alta" && (st === "confirmado" || st === "negado"),
    });
  }
}

function parseTerms(t: string, out: Map<string, DetectedField>) {
  const used = new Set<string>();
  const occupied: [number, number][] = [];
  const overlaps = (a: number, b: number) => occupied.some(([x, y]) => a < y && b > x);

  for (const { term, alias } of termsByAliasLength()) {
    if (used.has(term.id) && term.id !== "dm") continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
    const m = re.exec(t);
    if (!m) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    occupied.push([start, end]);
    used.add(term.id);
    if (!term.profileKey) continue;
    const { pre, post } = windowOf(t, start, m[0].length);
    const st = statusAround(pre, post);
    if (st === "familiar") continue;
    const conf = confidenceFor(st, false);
    const value = st === "negado" ? "nao" : term.profileValue || "sim";
    push(out, {
      key: term.profileKey,
      value,
      label: term.label,
      status: st,
      confidence: conf,
      evidence: m[0],
      autoApply: conf === "alta" && (st === "confirmado" || st === "negado"),
    });
    if (st === "confirmado" && term.alsoSet) {
      for (const extra of term.alsoSet) {
        push(out, { key: extra.key, value: extra.value, status: st, confidence: conf, autoApply: conf === "alta" });
      }
    }
  }
  parseBareIc(t, out);
}

function applyLabsToProfile(
  t: string,
  out: Map<string, DetectedField>,
  labHistory?: { testKey: string; value: number; measuredAt: string }[]
) {
  const groups = parseLabGroups(t);
  const latest = new Map<string, number>();
  for (const g of groups) {
    for (const lab of g.labs) latest.set(lab.testKey, lab.value);
  }
  const rac = latest.get("rac") ?? latest.get("microalbuminuria");
  if (rac != null) {
    const a = aFromRac(rac);
    if (a && (CATEGORIAS_A as readonly string[]).includes(a)) {
      push(out, { key: "categoria_a", value: a, status: "confirmado", confidence: "alta", autoApply: true, evidence: `RAC ${rac}` });
    }
  }
  const tfge = latest.get("tfge");
  const mentioned = parseDrcStage(t);
  const g = refineG(mentioned, tfge);
  if (g && (g === "G3" || (ESTAGIOS_G as readonly string[]).includes(g))) {
    const conf: IntelConfidence = mentioned || tfge != null ? "alta" : "media";
    push(out, { key: "estagio_g", value: g, status: "confirmado", confidence: conf, autoApply: conf === "alta" });
  } else if (mentioned) {
    push(out, { key: "estagio_g", value: mentioned, status: "confirmado", confidence: "alta", autoApply: true });
  }

  const series = [
    ...(labHistory || []).filter((l) => l.testKey === "tfge").map((l) => ({ value: l.value, at: l.measuredAt })),
    ...(tfge != null ? [{ value: tfge, at: new Date().toISOString() }] : []),
  ];
  const chronic = hasChronicReducedEgfr(series);
  const mentionedDrc = out.get("drc")?.value === "sim" || /\bdrc\b/.test(t);
  const gNow = out.get("estagio_g")?.value;
  const aNow = out.get("categoria_a")?.value;
  const fita = out.get("proteinuria_fita")?.value;
  if (canConfirmDrc({ mentionedDrc, g: gNow, a: aNow, proteinuriaFita: fita, chronicReducedEgfr: chronic })) {
    if (out.get("drc")?.status !== "negado") {
      push(out, { key: "drc", value: "sim", status: "confirmado", confidence: mentionedDrc || chronic || /^G[345]/.test(gNow || "") ? "alta" : "media", autoApply: mentionedDrc || chronic || /^G[345]/.test(gNow || "") });
    }
  } else if (gNow === "G1" || gNow === "G2") {
    // Categoria G isolada — não confirma DRC.
    if (!mentionedDrc) out.delete("drc");
  }

  if (/\b(etiologia|por)\b/.test(t) && /\b(diabet|nefropatia diabetica)\b/.test(t)) {
    push(out, { key: "etiologia_principal", value: "doenca_renal_diabetica", status: "confirmado", confidence: "alta", autoApply: true });
  }
}

/**
 * Extrai variáveis clínicas do texto da evolução (digitada ou ditada).
 */
export function extractClinicalFields(
  text: string,
  labHistory?: { testKey: string; value: number; measuredAt: string }[]
): DetectedField[] {
  const t = norm(text || "");
  if (!t.trim()) return [];
  const out = new Map<string, DetectedField>();

  parseTerms(t, out);
  parseSmoking(t, out);
  parseAllergies(t, out);
  parseMeds(t, out);
  parseEas(t, out);

  const occ = parseOccupation(t);
  if (occ) {
    push(out, { key: "profissao", value: occ, status: "confirmado", confidence: "alta", autoApply: true });
  }

  const dmYears =
    /(?:dm2?|diabet\w*)[^.\n;]{0,25}?(\d{1,2})\s*anos/.exec(t) ||
    /(\d{1,2})\s*anos[^.\n;]{0,20}?(?:de\s+)?(?:dm2?|diabet)/.exec(t);
  if (dmYears) {
    push(out, { key: "tempo_dm_anos", value: dmYears[1], status: "confirmado", confidence: "alta", autoApply: true });
  }

  const ckmStage =
    /(?:sindrome\s*)?ckm[^.\n;]{0,40}estagio\s*(4\s*[ab]|[1-4])/.exec(t) ||
    /estagio\s*(4\s*[ab]|[1-4])[^.\n;]{0,40}(?:sindrome\s*)?ckm/.exec(t);
  if (ckmStage) {
    const raw = ckmStage[1].replace(/\s+/g, "").toLowerCase();
    if (["1", "2", "3", "4", "4a", "4b"].includes(raw)) {
      push(out, { key: "ckm_estadio", value: raw, status: "confirmado", confidence: "alta", autoApply: true });
      push(out, { key: "ckm", value: "sim", status: "confirmado", confidence: "alta", autoApply: true });
    }
  }

  applyLabsToProfile(t, out, labHistory);

  return Array.from(out.values());
}

export function splitByConfidence(detected: DetectedField[]) {
  const auto = detected.filter((d) => d.autoApply && d.confidence === "alta");
  const review = detected.filter((d) => !auto.includes(d) && d.confidence !== "baixa");
  const skipped = detected.filter((d) => d.confidence === "baixa");
  return { auto, review, skipped };
}

export function findingsToChanges(rows: DetectedField[]): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const r of rows) {
    if (r.status === "familiar" || r.status === "suspeito" || r.status === "resolvido") continue;
    changes[r.key] = r.value;
  }
  return changes;
}

export function gFromEgfrPublic(n: number) {
  return gFromEgfr(n);
}

export function aFromRacPublic(n: number) {
  return aFromRac(n);
}
