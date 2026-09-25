import { getTool } from "./catalog";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function yes(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  if (s === "sim" || s === "true" || s === "1") return true;
  if (s === "nao" || s === "não" || s === "false" || s === "0") return false;
  return null;
}

const NO_PALLIATIVE_LABEL =
  "Indicadores sugerem necessidade de avaliação de cuidados de suporte e planejamento compartilhado.";

export function calcSpict(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("spict")!;
  const assessed = yes(o.spict_avaliado) ?? yes(ctx.extra.spict_avaliado);
  const positive = yes(o.spict_indicadores) ?? yes(ctx.extra.spict_indicadores);
  const note = str(o.spict_note) ?? str(ctx.extra.spict_note);
  const at = str(o.spict_at) ?? str(ctx.extra.spict_at);
  if (assessed !== true) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
      status: "needs_clinical",
      headline: "SPICT: avaliação possível",
      explanation: "O SPICT identifica pessoas que podem se beneficiar de avaliação de necessidades, cuidado de suporte e planejamento antecipado. Não estima meses de vida e não rotula o paciente como paliativo. Use o instrumento oficial (link) e registre os indicadores.",
      missing: ["avaliação dos indicadores clínicos"],
      values: [],
      staleWarnings: [],
      inputs: {},
      outputs: {},
    };
  }
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
    status: "recorded",
    headline: positive ? "Indicadores para considerar avaliação de cuidados de suporte" : "Indicadores SPICT não assinalados nesta avaliação",
    explanation: positive
      ? `${NO_PALLIATIVE_LABEL} A decisão permanece com a equipe e o paciente.`
      : "Registro clínico. Não é expectativa de vida.",
    missing: [],
    values: [
      { label: "Data", value: at || "—" },
      { label: "Indicadores assinalados", value: positive ? "sim" : "não" },
      { label: "Observação", value: note || "—" },
    ],
    staleWarnings: [],
    inputs: { spict_avaliado: true, spict_indicadores: positive, spict_note: note, spict_at: at },
    outputs: { considerar_avaliacao_suporte: Boolean(positive) },
  };
}

export function calcNecpal(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("necpal")!;
  const assessed = yes(o.necpal_avaliado) ?? yes(ctx.extra.necpal_avaliado);
  const surpriseNo = yes(o.necpal_surpresa_nao) ?? yes(ctx.extra.necpal_surpresa_nao);
  const indicators = yes(o.necpal_indicadores) ?? yes(ctx.extra.necpal_indicadores);
  const note = str(o.necpal_note) ?? str(ctx.extra.necpal_note);
  const at = str(o.necpal_at) ?? str(ctx.extra.necpal_at);
  if (assessed !== true) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "needs_clinical",
      headline: "NECPAL: dados incompletos",
      explanation: "NECPAL ajuda a identificar possíveis necessidades de cuidado paliativo/suporte em doença crônica avançada, inclusive DRC grave. Não estima sobrevida, não recusa diálise e não limita tratamento automaticamente.",
      missing: ["avaliação clínica NECPAL"],
      values: [],
      staleWarnings: [],
      inputs: {},
      outputs: {},
    };
  }
  const identified = surpriseNo === true && indicators === true;
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "recorded",
    headline: identified
      ? "Necessidade de avaliação de cuidado paliativo/suporte identificada"
      : "NECPAL registrado — necessidade de avaliação não identificada nesta aplicação",
    explanation: identified
      ? `${NO_PALLIATIVE_LABEL} Não usar para suspender tratamento, recusar diálise ou definir limitação terapêutica sem avaliação médica.`
      : "Registro. Não é prognóstico individual automático.",
    missing: [],
    values: [
      { label: "Data", value: at || "—" },
      { label: "Pergunta surpresa (não se surpreenderia)", value: surpriseNo == null ? "—" : surpriseNo ? "sim" : "não" },
      { label: "Indicadores de doença avançada", value: indicators == null ? "—" : indicators ? "sim" : "não" },
      { label: "Observação", value: note || "—" },
    ],
    staleWarnings: [],
    inputs: { necpal_avaliado: true, necpal_surpresa_nao: surpriseNo, necpal_indicadores: indicators, necpal_note: note },
    outputs: { necessidade_avaliacao: identified },
  };
}

export function calcPps(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("pps")!;
  const score = n(o.pps_score) ?? n(ctx.extra.pps_score);
  const prev = n(o.pps_anterior) ?? n(ctx.extra.pps_anterior);
  const at = str(o.pps_at) ?? str(ctx.extra.pps_at);
  if (score == null) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "needs_clinical",
      headline: "PPS: não registrado (licença do conteúdo oficial pendente)",
      explanation: "A tabela/algoritmo do PPSv2 não está incorporada. O médico pode registrar um escore 0–100 se o tiver obtido no instrumento oficial autorizado.",
      missing: ["escore PPS informado"],
      values: prev != null ? [{ label: "PPS anterior", value: String(prev) }] : [],
      staleWarnings: [],
      inputs: { pps_anterior: prev },
      outputs: {},
    };
  }
  if (score < 0 || score > 100) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "missing",
      headline: "Não foi possível registrar — PPS deve estar entre 0 e 100.",
      explanation: "Sem a tabela oficial neste app.",
      missing: ["escore PPS válido"],
      values: [],
      staleWarnings: [],
      inputs: { pps_score: score },
      outputs: {},
    };
  }
  const trend = prev == null ? "—" : score < prev ? "queda" : score > prev ? "alta" : "estável";
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "recorded",
    headline: prev != null ? `PPS anterior ${prev} → atual ${score}` : `PPS: ${score}`,
    explanation: "Registro informado pelo médico. Não usamos PPS para rotular o paciente como terminal.",
    missing: [],
    values: [
      { label: "PPS atual", value: String(score), date: at },
      { label: "PPS anterior", value: prev != null ? String(prev) : "—" },
      { label: "Tendência", value: trend },
    ],
    staleWarnings: [],
    inputs: { pps_score: score, pps_anterior: prev, pps_at: at },
    outputs: { pps: score, pps_anterior: prev, tendencia: trend },
  };
}
