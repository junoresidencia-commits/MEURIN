import { CALC_TOOLS, SECTION_LABEL, getTool, type ToolMeta } from "./catalog";
import { calcKtvTool, calcUrrTool } from "./dialysis";
import {
  calcAnionGap,
  calcCaCorr,
  calcDeltaGap,
  calcFena,
  calcFeureia,
  calcNaGlucose,
  calcOsm,
} from "./electrolytes";
import { calcCfs, calcFunctionBasic, calcGeriatricPrognosis } from "./geriatrics";
import { calcGeriatricMedReview, calcPolypharmacy, calcRenalDose } from "./meds";
import { calcPrevent } from "./prevent";
import {
  calcCkdEpiCr,
  calcCkdEpiCrCys,
  calcCkdEpiCys,
  calcCockcroftGault,
  calcKdigoGA,
  calcKfre,
} from "./renal";
import { calcNecpal, calcPps, calcSpict } from "./support";
import type { CalcContext, CalcResult, CalcSection, CalcStatus, ManualOverrides } from "./types";

type CalcFn = (ctx: CalcContext, o?: ManualOverrides) => CalcResult;

const FNS: Record<string, CalcFn> = {
  ckd_epi_cr_2021: calcCkdEpiCr,
  ckd_epi_cys_2021: calcCkdEpiCys,
  ckd_epi_cr_cys_2021: calcCkdEpiCrCys,
  kdigo_ga: calcKdigoGA,
  cockcroft_gault: calcCockcroftGault,
  kfre_4var: calcKfre,
  prevent: calcPrevent,
  renal_dose: calcRenalDose,
  polypharmacy: calcPolypharmacy,
  geriatric_med_review: calcGeriatricMedReview,
  urr: calcUrrTool,
  ktv_daugirdas: calcKtvTool,
  anion_gap: calcAnionGap,
  delta_gap: calcDeltaGap,
  na_corrected_glucose: calcNaGlucose,
  osm_calculated: calcOsm,
  ca_corrected: calcCaCorr,
  fena: calcFena,
  feureia: calcFeureia,
  cfs: calcCfs,
  function_basic: calcFunctionBasic,
  geriatric_prognosis: calcGeriatricPrognosis,
  spict: calcSpict,
  necpal: calcNecpal,
  pps: calcPps,
};

export const AUTO_TOOL_IDS = CALC_TOOLS.filter((t) => t.active).map((t) => t.id);

export function runTool(id: string, ctx: CalcContext, overrides: ManualOverrides = {}): CalcResult {
  const fn = FNS[id];
  if (!fn) {
    const t = getTool(id);
    return {
      toolId: id,
      section: t?.section || "rim",
      title: t?.title || id,
      status: "not_applicable",
      headline: "Ferramenta inativa ou desconhecida.",
      explanation: "Não há função de cálculo para este id.",
      missing: [],
      values: [],
      staleWarnings: [],
      formula: t?.formula || "",
      source: t?.source || "",
      version: t?.version || "",
      published: t?.published || "",
      population: t?.population || "",
      limitations: t?.limitations || "",
      inputs: {},
      outputs: {},
    };
  }
  return fn(ctx, overrides);
}

export type RunCounts = {
  updated: number;
  needData: number;
  notApplicable: number;
  needClinical: number;
};

export function countResults(results: CalcResult[]): RunCounts {
  const by = (s: CalcStatus) => results.filter((r) => r.status === s).length;
  return {
    updated: by("ok") + by("recorded"),
    needData: by("missing"),
    notApplicable: by("not_applicable"),
    needClinical: by("needs_clinical"),
  };
}

export function runAll(ctx: CalcContext, overrides: ManualOverrides = {}, ids: string[] = AUTO_TOOL_IDS): {
  results: CalcResult[];
  counts: RunCounts;
} {
  const results = ids.map((id) => runTool(id, ctx, overrides));
  return { results, counts: countResults(results) };
}

export function resultsBySection(results: CalcResult[]): Record<CalcSection, CalcResult[]> {
  const out = {} as Record<CalcSection, CalcResult[]>;
  for (const s of Object.keys(SECTION_LABEL) as CalcSection[]) out[s] = [];
  for (const r of results) out[r.section].push(r);
  return out;
}

export function catalogPublic(): ToolMeta[] {
  return CALC_TOOLS.filter((t) => t.active);
}
