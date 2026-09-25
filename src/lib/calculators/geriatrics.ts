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

export function calcCfs(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("cfs")!;
  const score = n(o.cfs_score) ?? n(ctx.extra.cfs_score);
  const at = str(o.cfs_at) ?? str(ctx.extra.cfs_at);
  const by = str(o.cfs_by) ?? str(ctx.extra.cfs_by);
  const context = str(o.cfs_context) ?? str(ctx.extra.cfs_context);
  const note = str(o.cfs_note) ?? str(ctx.extra.cfs_note);
  if (score == null) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
      status: "needs_clinical",
      headline: "CFS: ainda não avaliada",
      explanation: "A Clinical Frailty Scale depende de avaliação clínica do estado funcional basal. Não calculamos pela idade nem pelos diagnósticos. Use o instrumento oficial (link) e registre o escore.",
      missing: ["avaliação clínica (escore CFS)"],
      values: [],
      staleWarnings: [],
      inputs: { idade: ctx.ageYears },
      outputs: {},
    };
  }
  if (score < 1 || score > 9 || !Number.isInteger(score)) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
      status: "missing",
      headline: "Não foi possível registrar — escore CFS deve ser inteiro de 1 a 9.",
      explanation: "Não inferimos o valor. Consulte o instrumento oficial antes de atribuir.",
      missing: ["escore CFS válido (1–9)"],
      values: [],
      staleWarnings: [],
      inputs: { cfs_score: score },
      outputs: {},
    };
  }
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
    status: "recorded",
    headline: `CFS: ${score}`,
    explanation: "Escore atribuído após avaliação clínica. Fragilidade não é prognóstico automático de morte.",
    missing: [],
    values: [
      { label: "CFS", value: String(score) },
      { label: "Data", value: at || "—" },
      { label: "Avaliado por", value: by || "—" },
      { label: "Contexto", value: context || "—" },
      { label: "Observação", value: note || "—" },
    ],
    staleWarnings: [],
    inputs: { cfs_score: score, cfs_at: at, cfs_by: by, cfs_context: context, cfs_note: note },
    outputs: { cfs: score },
  };
}

export function calcFunctionBasic(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("function_basic")!;
  const abvd = str(o.abvd) ?? str(ctx.extra.abvd);
  const aivd = str(o.aivd) ?? str(ctx.extra.aivd);
  const mobility = str(o.mobilidade) ?? str(ctx.extra.mobilidade);
  const caregiver = str(o.cuidador) ?? str(ctx.extra.cuidador);
  const dependency = str(o.dependencia) ?? str(ctx.extra.dependencia);
  if (!abvd && !aivd && !mobility && !caregiver && !dependency) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "needs_clinical",
      headline: "Funcionalidade ainda não registrada",
      explanation: "Campos clínicos (ABVD, AIVD, mobilidade, dependência, cuidador). Não é uma escala licenciada nem nota de mortalidade.",
      missing: ["avaliação funcional"],
      values: [],
      staleWarnings: [],
      inputs: {},
      outputs: {},
    };
  }
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "recorded",
    headline: "Funcionalidade registrada (não é prognóstico)",
    explanation: "Separado de fragilidade, necessidades paliativas e prognóstico. Não geramos risco de morte a partir destes campos.",
    missing: [],
    values: [
      { label: "ABVD", value: abvd || "—" },
      { label: "AIVD", value: aivd || "—" },
      { label: "Mobilidade", value: mobility || "—" },
      { label: "Dependência", value: dependency || "—" },
      { label: "Cuidador", value: caregiver || "—" },
    ],
    staleWarnings: [],
    inputs: { abvd, aivd, mobilidade: mobility, dependencia: dependency, cuidador: caregiver },
    outputs: { registrado: true },
  };
}

export function calcGeriatricPrognosis(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("geriatric_prognosis")!;
  const indexId = str(o.indice) ?? str(ctx.extra.indice_geriatrico);
  if (!indexId) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "not_applicable",
      headline: "Nenhum índice geriátrico cadastrado nesta versão.",
      explanation: "Não há calculadora universal de mortalidade. Cada índice futuro guardará nome, população, faixa etária, desfecho, horizonte, variáveis, publicação e versão. Sem cadastro + população adequada, não apresentamos resultado.",
      missing: [],
      values: [],
      staleWarnings: [],
      inputs: { idade: ctx.ageYears },
      outputs: { indices_ativos: 0 },
    };
  }
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "not_applicable",
    headline: "Esta ferramenta é apropriada para este paciente? Não — índice não cadastrado.",
    explanation: `Índice “${indexId}” ainda não está no catálogo com população e coeficientes. Não calculamos.`,
    missing: [],
    values: [],
    staleWarnings: [],
    inputs: { indice: indexId },
    outputs: {},
  };
}
