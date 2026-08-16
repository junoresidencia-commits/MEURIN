import "server-only";
import { listPatientsByDoctor, clinicalKey } from "./patients-store";
import { getLabResults } from "./patient-store";
import { buildCohortRecords, applyFilters, type CohortRecord, type Filter } from "./research";
import { RESEARCH_VARS_BY_KEY } from "./research-fields";

/* ============================================================================
   Motor de ANÁLISE científica (determinístico, só a partir de dados REAIS).
   Nada aqui inventa números — todas as saídas derivam da coorte do médico.
   ============================================================================ */

export interface NumStats {
  n: number;
  mean: number;
  sd: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

function round(x: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

/** Estatística numérica completa (média±DP, mediana [IQI], min–max). */
export function numStats(vals: number[]): NumStats | null {
  const s = vals.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return null;
  const mean = s.reduce((x, y) => x + y, 0) / n;
  const variance = n > 1 ? s.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const q = (p: number): number => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return { n, mean: round(mean), sd: round(sd), median: round(q(0.5)), q1: round(q(0.25)), q3: round(q(0.75)), min: s[0], max: s[n - 1] };
}

/** Quantos registros têm a variável preenchida (numérico finito; categórico ≠ "desconhecido"/vazio). */
export interface Completeness {
  key: string;
  label: string;
  type: "num" | "cat" | "text";
  available: number;
  total: number;
  pct: number;
}
export function completeness(records: CohortRecord[], variables: string[]): Completeness[] {
  const total = records.length;
  return variables.map((key) => {
    const def = RESEARCH_VARS_BY_KEY.get(key);
    const type = (def?.type as "num" | "cat" | "text") || "cat";
    let available = 0;
    for (const r of records) {
      const raw = r[key];
      const has =
        type === "num"
          ? raw !== null && raw !== undefined && Number.isFinite(Number(raw))
          : raw !== null && raw !== undefined && String(raw) !== "" && String(raw) !== "desconhecido";
      if (has) available += 1;
    }
    return { key, label: def?.label || key, type, available, total, pct: total ? round((available / total) * 100, 1) : 0 };
  });
}

/** Tabela 1 — descreve cada variável selecionada (numérica ou categórica). */
export type TableRow =
  | { key: string; label: string; type: "num"; unit?: string; num: NumStats | null }
  | { key: string; label: string; type: "cat" | "text"; cat: Record<string, number> };

export function describeVars(records: CohortRecord[], variables: string[]): TableRow[] {
  return variables.map((key): TableRow => {
    const def = RESEARCH_VARS_BY_KEY.get(key);
    if (def?.type === "num") {
      const vals = records.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
      return { key, label: def.label, type: "num", unit: def.unit, num: numStats(vals) };
    }
    const cat: Record<string, number> = {};
    for (const r of records) {
      const v = String(r[key] ?? "desconhecido");
      cat[v] = (cat[v] || 0) + 1;
    }
    return { key, label: def?.label || key, type: (def?.type as "cat" | "text") || "cat", cat };
  });
}

/** Inclinação (unidades/ano) por regressão linear simples de uma série temporal. */
function slopePerYear(points: { t: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.t / (365.25 * 24 * 3600 * 1000)); // anos
  const ys = points.map((p) => p.y);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Conta pacientes com queda de TFGe rápida (≥ threshold mL/min/1,73m²/ano),
 * usando a série longitudinal real de TFGe (mín. de pontos e de intervalo).
 */
export async function egfrRapidDeclineCount(
  doctorId: string,
  opts: { thresholdPerYear?: number; minPoints?: number; minSpanDays?: number } = {}
): Promise<number> {
  const thresholdPerYear = opts.thresholdPerYear ?? 5;
  const minPoints = opts.minPoints ?? 3;
  const minSpanDays = opts.minSpanDays ?? 180;
  const patients = await listPatientsByDoctor(doctorId);
  let count = 0;
  for (const p of patients) {
    const labs = await getLabResults(clinicalKey(p));
    const series = labs
      .filter((l) => l.testKey === "tfge" && Number.isFinite(l.value))
      .map((l) => ({ t: new Date(l.measuredAt).getTime(), y: l.value }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);
    if (series.length < minPoints) continue;
    const spanDays = (series[series.length - 1].t - series[0].t) / (24 * 3600 * 1000);
    if (spanDays < minSpanDays) continue;
    const slope = slopePerYear(series);
    if (slope != null && slope <= -thresholdPerYear) count += 1;
  }
  return count;
}

/** Séries longitudinais (anonimizadas) de um exame para a coorte filtrada. */
export interface PatientSeries {
  code: string;
  points: { t: string; y: number }[];
}
export async function cohortSeries(doctorId: string, filters: Filter[], testKey: string): Promise<PatientSeries[]> {
  const all = await buildCohortRecords(doctorId);
  const matched = applyFilters(all, filters);
  const ids = new Set(matched.map((r) => String(r.__id)));
  const patients = await listPatientsByDoctor(doctorId);
  const series: PatientSeries[] = [];
  let i = 0;
  for (const p of patients) {
    if (!ids.has(p.id)) continue;
    i += 1;
    const labs = await getLabResults(clinicalKey(p));
    const points = labs
      .filter((l) => l.testKey === testKey && Number.isFinite(l.value))
      .map((l) => ({ t: new Date(l.measuredAt).toISOString().slice(0, 10), y: l.value }))
      .sort((a, b) => a.t.localeCompare(b.t));
    if (points.length) series.push({ code: `P${String(i).padStart(4, "0")}`, points });
  }
  return series;
}

/** Sugestão de estudo derivada de contagem REAL nos dados do médico. */
export interface StudyIdea {
  key: string;
  title: string;
  question: string;
  suggestedType: string;
  count: number;
  viable: boolean; // N mínimo para análise minimamente confiável
  filters: Filter[];
  note?: string;
}

const MIN_VIABLE = 10;

/** Gera ideias de estudo a partir de padrões reais (nunca inicia estudo sozinho). */
export async function suggestStudies(doctorId: string): Promise<{ total: number; ideas: StudyIdea[] }> {
  const records = await buildCohortRecords(doctorId);
  const total = records.length;
  const count = (filters: Filter[]) => applyFilters(records, filters).length;

  const ideas: StudyIdea[] = [];
  const push = (key: string, title: string, question: string, suggestedType: string, filters: Filter[], note?: string) => {
    const c = count(filters);
    if (c > 0) ideas.push({ key, title, question, suggestedType, count: c, viable: c >= MIN_VIABLE, filters, note });
  };

  push(
    "drc_dm",
    "DRC em diabéticos",
    "Qual o perfil e a progressão da doença renal crônica em pacientes diabéticos acompanhados na sua prática?",
    "coorte_retro",
    [
      { field: "drc", op: "=", value: "sim" },
      { field: "dm", op: "=", value: "sim" },
    ]
  );
  push(
    "proteinuria_alta",
    "Proteinúria significativa",
    "Qual o perfil clínico e etiológico dos pacientes com proteinúria significativa (RAC > 300 mg/g)?",
    "transversal",
    [{ field: "lab_rac", op: ">", value: "300" }]
  );
  push(
    "jovem_drc",
    "DRC em jovens",
    "Qual o perfil de pacientes jovens (< 40 anos) com doença renal crônica?",
    "serie_casos",
    [
      { field: "idade", op: "<", value: "40" },
      { field: "drc", op: "=", value: "sim" },
    ]
  );
  push(
    "rim_unico",
    "Rim único",
    "Qual o perfil clínico e a evolução da função renal em pacientes com rim único?",
    "serie_casos",
    [{ field: "rim_unico", op: "=", value: "sim" }]
  );
  push(
    "glomerulopatia",
    "Glomerulopatias",
    "Qual o perfil das glomerulopatias acompanhadas na sua prática?",
    "serie_casos",
    [{ field: "glomerulopatia", op: "=", value: "sim" }]
  );
  push(
    "hipercalemia",
    "Hipercalemia na DRC",
    "Quais fatores estão associados à hipercalemia (K > 5,5) em pacientes com DRC?",
    "transversal",
    [
      { field: "drc", op: "=", value: "sim" },
      { field: "lab_potassio", op: ">", value: "5.5" },
    ]
  );

  // Longitudinal: queda rápida da TFGe (usa a série temporal real).
  const rapid = await egfrRapidDeclineCount(doctorId);
  if (rapid > 0) {
    ideas.push({
      key: "queda_tfge",
      title: "Queda rápida da TFGe",
      question: "Quais fatores estão associados à queda rápida da TFGe (≥ 5 mL/min/1,73m²/ano) na sua coorte?",
      suggestedType: "coorte_retro",
      count: rapid,
      viable: rapid >= MIN_VIABLE,
      filters: [],
      note: "Baseado na série longitudinal de TFGe (≥ 3 medidas, intervalo ≥ 6 meses).",
    });
  }

  ideas.sort((a, b) => b.count - a.count);
  return { total, ideas };
}

/**
 * Texto de RESULTADOS determinístico — construído SOMENTE com os números da coorte.
 * (Ponto de partida para o médico editar; não substitui redação nem interpreta.)
 */
export function resultsText(question: string, n: number, total: number, rows: TableRow[]): string {
  const L: string[] = [];
  L.push(`Foram incluídos ${n} paciente(s) de um total de ${total} no banco (${total ? round((n / total) * 100, 1) : 0}%).`);
  for (const r of rows) {
    if (r.type === "num") {
      if (!r.num) {
        L.push(`${r.label}: sem dados disponíveis.`);
        continue;
      }
      const u = r.unit ? ` ${r.unit}` : "";
      L.push(
        `${r.label}: média ${r.num.mean} ± ${r.num.sd}${u} (mediana ${r.num.median}, IQI ${r.num.q1}–${r.num.q3}; n=${r.num.n}).`
      );
    } else {
      const entries = Object.entries(r.cat)
        .filter(([k]) => k !== "desconhecido")
        .sort((a, b) => b[1] - a[1]);
      const parts = entries.map(([k, v]) => `${k}: ${v} (${n ? round((v / n) * 100, 1) : 0}%)`);
      const unknown = r.cat["desconhecido"] || 0;
      const tail = unknown ? ` [desconhecido: ${unknown}]` : "";
      L.push(`${r.label} — ${parts.join("; ") || "sem dados"}.${tail}`);
    }
  }
  return L.join("\n");
}
