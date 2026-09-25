import { ckdEpi2021, ckdEpiCystatin2021 } from "../egfr";
import { aFromRac, gFromEgfr } from "../kdigo";
import { getTool } from "./catalog";
import { daysOld, staleWarning } from "./context";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function base(id: string): Omit<CalcResult, "status" | "headline" | "explanation" | "missing" | "values" | "staleWarnings" | "inputs" | "outputs"> {
  const t = getTool(id)!;
  return {
    toolId: id,
    section: t.section,
    title: t.title,
    formula: t.formula,
    source: t.source,
    version: t.version,
    published: t.published,
    population: t.population,
    limitations: t.limitations,
    officialUrl: t.officialUrl,
  };
}

function lab(ctx: CalcContext, key: string) {
  return ctx.labs[key] || null;
}

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

export function ckdEpiCrCys2021(cr: number, cys: number, age: number, sex: "male" | "female"): number {
  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.219 : -0.144;
  const egfr =
    135 *
    Math.pow(Math.min(cr / kappa, 1), alpha) *
    Math.pow(Math.max(cr / kappa, 1), -0.544) *
    Math.pow(Math.min(cys / 0.8, 1), -0.323) *
    Math.pow(Math.max(cys / 0.8, 1), -0.778) *
    Math.pow(0.9961, age) *
    (sex === "female" ? 0.963 : 1);
  return Math.round(egfr * 10) / 10;
}

function missingResult(id: string, missing: string[], extra?: string): CalcResult {
  return {
    ...base(id),
    status: "missing",
    headline: `Não foi possível calcular — falta ${missing.join(", ")}.`,
    explanation: extra || "Nenhum dado foi inventado. Preencha o que falta ou lance no prontuário.",
    missing,
    values: [],
    staleWarnings: [],
    inputs: {},
    outputs: {},
  };
}

function na(id: string, reason: string): CalcResult {
  return {
    ...base(id),
    status: "not_applicable",
    headline: "Não aplicável a este paciente.",
    explanation: reason,
    missing: [],
    values: [],
    staleWarnings: [],
    inputs: {},
    outputs: {},
  };
}

export function calcCkdEpiCr(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const cr = n(o.creatinina) ?? lab(ctx, "creatinina")?.value ?? null;
  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  const crAt = lab(ctx, "creatinina")?.measuredAt || null;
  const missing: string[] = [];
  if (cr == null) missing.push("creatinina");
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (cr == null || age == null || !sex) return missingResult("ckd_epi_cr_2021", missing);
  const egfr = ckdEpi2021(cr, age, sex);
  const g = gFromEgfr(egfr);
  return {
    ...base("ckd_epi_cr_2021"),
    status: "ok",
    headline: `TFG: ${String(egfr).replace(".", ",")} mL/min/1,73 m²`,
    explanation: g ? `Categoria: ${g}. Estimativa CKD-EPI 2021 (creatinina). O médico decide a conduta.` : "Estimativa CKD-EPI 2021 (creatinina).",
    missing: [],
    values: [
      { label: "TFGe", value: String(egfr).replace(".", ","), unit: "mL/min/1,73 m²", date: crAt, daysOld: daysOld(crAt) },
      { label: "Categoria G", value: g || "—" },
      { label: "Creatinina", value: String(cr).replace(".", ","), unit: "mg/dL", date: crAt },
      { label: "Idade usada", value: String(age), unit: "anos" },
      { label: "Sexo", value: sex === "female" ? "feminino" : "masculino" },
    ],
    staleWarnings: [staleWarning("creatinina", crAt)].filter(Boolean) as string[],
    inputs: { creatinina: cr, idade: age, sexo: sex, data_creatinina: crAt },
    outputs: { tfge: egfr, categoria_g: g },
  };
}

export function calcCkdEpiCys(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const cys = n(o.cistatina_c) ?? lab(ctx, "cistatina_c")?.value ?? null;
  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  const at = lab(ctx, "cistatina_c")?.measuredAt || null;
  const missing: string[] = [];
  if (cys == null) missing.push("cistatina C");
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (cys == null || age == null || !sex) return missingResult("ckd_epi_cys_2021", missing);
  const egfr = ckdEpiCystatin2021(cys, age, sex);
  const g = gFromEgfr(egfr);
  return {
    ...base("ckd_epi_cys_2021"),
    status: "ok",
    headline: `TFG (cistatina): ${String(egfr).replace(".", ",")} mL/min/1,73 m²`,
    explanation: g ? `Categoria: ${g}.` : "Estimativa CKD-EPI 2021 (cistatina C).",
    missing: [],
    values: [
      { label: "TFGe cistatina", value: String(egfr).replace(".", ","), unit: "mL/min/1,73 m²", date: at },
      { label: "Cistatina C", value: String(cys).replace(".", ","), unit: "mg/L", date: at },
    ],
    staleWarnings: [staleWarning("cistatina C", at)].filter(Boolean) as string[],
    inputs: { cistatina_c: cys, idade: age, sexo: sex },
    outputs: { tfge_cistatina: egfr, categoria_g: g },
  };
}

export function calcCkdEpiCrCys(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const cr = n(o.creatinina) ?? lab(ctx, "creatinina")?.value ?? null;
  const cys = n(o.cistatina_c) ?? lab(ctx, "cistatina_c")?.value ?? null;
  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  const missing: string[] = [];
  if (cr == null) missing.push("creatinina");
  if (cys == null) missing.push("cistatina C");
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (cr == null || cys == null || age == null || !sex) return missingResult("ckd_epi_cr_cys_2021", missing);
  const egfr = ckdEpiCrCys2021(cr, cys, age, sex);
  const g = gFromEgfr(egfr);
  return {
    ...base("ckd_epi_cr_cys_2021"),
    status: "ok",
    headline: `TFG (Cr+cistatina): ${String(egfr).replace(".", ",")} mL/min/1,73 m²`,
    explanation: g ? `Categoria: ${g}.` : "CKD-EPI 2021 combinada.",
    missing: [],
    values: [
      { label: "TFGe Cr+Cys", value: String(egfr).replace(".", ","), unit: "mL/min/1,73 m²" },
      { label: "Creatinina", value: String(cr).replace(".", ","), unit: "mg/dL", date: lab(ctx, "creatinina")?.measuredAt },
      { label: "Cistatina C", value: String(cys).replace(".", ","), unit: "mg/L", date: lab(ctx, "cistatina_c")?.measuredAt },
    ],
    staleWarnings: [staleWarning("creatinina", lab(ctx, "creatinina")?.measuredAt)].filter(Boolean) as string[],
    inputs: { creatinina: cr, cistatina_c: cys, idade: age, sexo: sex },
    outputs: { tfge_cr_cys: egfr, categoria_g: g },
  };
}

export function calcKdigoGA(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const tfge = n(o.tfge) ?? lab(ctx, "tfge")?.value ?? null;
  const crRes = tfge == null ? calcCkdEpiCr(ctx, o) : null;
  const egfr = tfge ?? (crRes?.status === "ok" ? Number(crRes.outputs.tfge) : null);
  const rac = n(o.rac) ?? lab(ctx, "rac")?.value ?? null;
  const g = egfr != null ? gFromEgfr(egfr) : null;
  const a = rac != null ? aFromRac(rac) : null;
  if (g == null && a == null) {
    return missingResult("kdigo_ga", ["TFGe ou creatinina", "RAC (ACR)"], "Não inferimos albuminúria ausente.");
  }
  const combo = [g, a].filter(Boolean).join(" ");
  const missing: string[] = [];
  if (g == null) missing.push("TFGe");
  if (a == null) missing.push("ACR");
  return {
    ...base("kdigo_ga"),
    status: a == null || g == null ? "missing" : "ok",
    headline: combo || "Classificação incompleta",
    explanation:
      a == null
        ? `TFG → ${g}. Não foi possível calcular A — falta ACR.`
        : g == null
          ? `ACR → ${a}. Falta TFGe.`
          : `TFG → ${g}. ACR → ${a}.`,
    missing,
    values: [
      { label: "G", value: g || "—", date: lab(ctx, "tfge")?.measuredAt || lab(ctx, "creatinina")?.measuredAt },
      { label: "A", value: a || "—", date: lab(ctx, "rac")?.measuredAt },
      { label: "TFGe usada", value: egfr != null ? String(egfr).replace(".", ",") : "—", unit: "mL/min/1,73 m²" },
      { label: "RAC", value: rac != null ? String(rac).replace(".", ",") : "—", unit: "mg/g" },
    ],
    staleWarnings: [staleWarning("creatinina/TFGe", lab(ctx, "creatinina")?.measuredAt)].filter(Boolean) as string[],
    inputs: { tfge: egfr, rac },
    outputs: { g, a, ga: combo },
  };
}

export function calcCockcroftGault(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const cr = n(o.creatinina) ?? lab(ctx, "creatinina")?.value ?? null;
  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  const weight = n(o.peso_kg) ?? ctx.weightKg;
  const missing: string[] = [];
  if (cr == null) missing.push("creatinina");
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (weight == null) missing.push("peso");
  if (cr == null || age == null || !sex || weight == null) return missingResult("cockcroft_gault", missing);
  const crcl = ((140 - age) * weight * (sex === "female" ? 0.85 : 1)) / (72 * cr);
  const rounded = Math.round(crcl * 10) / 10;
  return {
    ...base("cockcroft_gault"),
    status: "ok",
    headline: `CrCl calculado por Cockcroft-Gault: ${String(rounded).replace(".", ",")} mL/min`,
    explanation: "Este resultado não é CKD-EPI. Use quando a referência de dose exigir CrCl.",
    missing: [],
    values: [
      { label: "CrCl", value: String(rounded).replace(".", ","), unit: "mL/min" },
      { label: "Peso utilizado", value: String(weight).replace(".", ","), unit: "kg" },
      { label: "Idade", value: String(age), unit: "anos" },
      { label: "Sexo", value: sex === "female" ? "feminino" : "masculino" },
      { label: "Creatinina", value: String(cr).replace(".", ","), unit: "mg/dL", date: lab(ctx, "creatinina")?.measuredAt },
    ],
    staleWarnings: [staleWarning("creatinina", lab(ctx, "creatinina")?.measuredAt)].filter(Boolean) as string[],
    inputs: { creatinina: cr, idade: age, sexo: sex, peso_kg: weight, data_creatinina: lab(ctx, "creatinina")?.measuredAt || null },
    outputs: { crcl: rounded },
  };
}

/** KFRE 4-var, calibração não-norte-americana (Brasil). ACR em mg/g. */
export function kfre4var(age: number, male: boolean, egfr: number, acrMgG: number): { y2: number; y5: number; pi: number } {
  const acrMmol = acrMgG / 8.84;
  const pi =
    -0.2201 * (age / 10 - 7.036) +
    0.2467 * ((male ? 1 : 0) - 0.5642) +
    -0.5567 * (egfr / 5 - 7.222) +
    0.451 * (Math.log(acrMmol) - 5.137);
  const y2 = 1 - Math.pow(0.9832, Math.exp(pi));
  const y5 = 1 - Math.pow(0.9365, Math.exp(pi));
  return { y2, y5, pi };
}

export function calcKfre(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  if (ctx.onKrt || o.em_trs === true) {
    return na("kfre_4var", "KFRE não aplicável — paciente já em terapia renal substitutiva.");
  }
  const crRes = calcCkdEpiCr(ctx, o);
  const egfr = n(o.tfge) ?? lab(ctx, "tfge")?.value ?? (crRes.status === "ok" ? Number(crRes.outputs.tfge) : null);
  const rac = n(o.rac) ?? lab(ctx, "rac")?.value ?? null;
  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  if (egfr != null && egfr >= 60) {
    return na("kfre_4var", "KFRE 4 variáveis foi validada em DRC com TFGe < 60 mL/min/1,73 m². Não extrapolar.");
  }
  const missing: string[] = [];
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (egfr == null) missing.push("TFGe");
  if (rac == null) missing.push("ACR");
  if (age == null || !sex || egfr == null || rac == null) return missingResult("kfre_4var", missing);
  if (age < 18) return na("kfre_4var", "KFRE não aplicável em pediatria neste módulo.");
  if (rac <= 0) return missingResult("kfre_4var", ["ACR válida (> 0)"]);
  const { y2, y5, pi } = kfre4var(age, sex === "male", egfr, rac);
  const pct = (x: number) => `${(Math.round(x * 1000) / 10).toString().replace(".", ",")}%`;
  return {
    ...base("kfre_4var"),
    status: "ok",
    headline: `Risco em 2 anos: ${pct(y2)} · 5 anos: ${pct(y5)}`,
    explanation: "Calibração não-norte-americana (Tangri 2016). Prediz falência renal tratada, não morte. O médico interpreta o risco.",
    missing: [],
    values: [
      { label: "Risco 2 anos", value: pct(y2) },
      { label: "Risco 5 anos", value: pct(y5) },
      { label: "TFGe", value: String(egfr).replace(".", ","), unit: "mL/min/1,73 m²" },
      { label: "ACR", value: String(rac).replace(".", ","), unit: "mg/g", date: lab(ctx, "rac")?.measuredAt },
      { label: "Idade", value: String(age) },
      { label: "Sexo", value: sex === "female" ? "feminino" : "masculino" },
    ],
    staleWarnings: [staleWarning("creatinina", lab(ctx, "creatinina")?.measuredAt)].filter(Boolean) as string[],
    inputs: { idade: age, sexo: sex, tfge: egfr, rac, pi: Math.round(pi * 10000) / 10000 },
    outputs: { risco_2a: Math.round(y2 * 1000) / 10, risco_5a: Math.round(y5 * 1000) / 10 },
  };
}
