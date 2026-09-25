import { getTool } from "./catalog";
import { calcCkdEpiCr } from "./renal";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
function lab(ctx: CalcContext, key: string) {
  return ctx.labs[key] || null;
}
function bool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase();
  if (s === "sim" || s === "true" || s === "1") return true;
  if (s === "nao" || s === "não" || s === "false" || s === "0") return false;
  return null;
}
function base() {
  const t = getTool("prevent")!;
  return {
    toolId: t.id,
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

/**
 * PREVENT (AHA): verifica população e dados.
 * Não reproduz coeficientes oficiais — o número sai da ferramenta da AHA.
 */
export function calcPrevent(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const knownCvd = o.dcv_conhecida === true || ctx.knownCvd;
  if (knownCvd) {
    return {
      ...base(),
      status: "not_applicable",
      headline: "PREVENT não aplicável neste cenário.",
      explanation: "A equação PREVENT não se destina a quem já tem doença cardiovascular conhecida. Não extrapolamos.",
      missing: [],
      values: [],
      staleWarnings: [],
      inputs: { dcv_conhecida: true },
      outputs: {},
    };
  }

  const age = n(o.idade) ?? ctx.ageYears;
  const sex = (o.sexo === "male" || o.sexo === "female" ? o.sexo : ctx.sex) as "male" | "female" | null;
  const sbp = n(o.pas) ?? ctx.sbp;
  const chol = n(o.colesterol_total) ?? lab(ctx, "colesterol_total")?.value ?? null;
  const hdl = n(o.hdl) ?? lab(ctx, "hdl")?.value ?? null;
  const dm = bool(o.diabetes) ?? ctx.diabetes;
  const smoke = bool(o.tabagismo) ?? ctx.smoking;
  const bmi = n(o.imc) ?? ctx.bmi;
  const crRes = calcCkdEpiCr(ctx, o);
  const egfr = n(o.tfge) ?? lab(ctx, "tfge")?.value ?? (crRes.status === "ok" ? Number(crRes.outputs.tfge) : null);

  if (age != null && (age < 30 || age > 79)) {
    return {
      ...base(),
      status: "not_applicable",
      headline: "PREVENT não aplicável neste cenário.",
      explanation: `População validada: 30–79 anos. Idade usada: ${age}. Não extrapolamos.`,
      missing: [],
      values: [{ label: "Idade", value: String(age), unit: "anos" }],
      staleWarnings: [],
      inputs: { idade: age },
      outputs: {},
    };
  }

  const missing: string[] = [];
  if (age == null) missing.push("idade");
  if (!sex) missing.push("sexo");
  if (sbp == null) missing.push("pressão arterial sistólica");
  if (chol == null) missing.push("colesterol total");
  if (hdl == null) missing.push("HDL");
  if (dm == null) missing.push("diabetes (sim/não)");
  if (smoke == null) missing.push("tabagismo (sim/não)");
  if (egfr == null) missing.push("TFGe");
  if (bmi == null) missing.push("IMC (peso e altura)");

  const optional: string[] = [];
  if (ctx.antihypertensive == null && o.anti_hipertensivo == null) optional.push("uso de anti-hipertensivo");
  if (ctx.statin == null && o.estatina == null) optional.push("uso de estatina");
  if (n(o.rac) == null && !lab(ctx, "rac")) optional.push("ACR (modelo opcional)");

  if (missing.length) {
    return {
      ...base(),
      status: "missing",
      headline: `Não foi possível calcular — falta ${missing.join(", ")}.`,
      explanation: optional.length
        ? `Também úteis, se existirem: ${optional.join(", ")}. Nenhum valor foi inventado.`
        : "Nenhum valor foi inventado. PREVENT não extrapola dados ausentes.",
      missing,
      values: [],
      staleWarnings: [],
      inputs: {
        idade: age, sexo: sex, pas: sbp, colesterol_total: chol, hdl, diabetes: dm, tabagismo: smoke, tfge: egfr, imc: bmi,
      },
      outputs: {},
    };
  }

  return {
    ...base(),
    status: "ok",
    headline: "PREVENT aplicável — risco numérico na ferramenta oficial da AHA",
    explanation:
      "Os critérios de população e os dados necessários estão presentes. Os coeficientes oficiais não foram reproduzidos neste módulo (marca e licença da AHA). Use o link oficial com os valores listados. Horizonte típico: 10 anos (e 30 anos na ferramenta da AHA, quando disponível).",
    missing: optional,
    values: [
      { label: "Horizonte", value: "10 anos (oficial AHA)" },
      { label: "Idade", value: String(age), unit: "anos" },
      { label: "Sexo", value: sex === "female" ? "feminino" : "masculino" },
      { label: "PAS", value: String(sbp), unit: "mmHg", date: ctx.bpAt },
      { label: "Colesterol total", value: String(chol), unit: "mg/dL", date: lab(ctx, "colesterol_total")?.measuredAt },
      { label: "HDL", value: String(hdl), unit: "mg/dL", date: lab(ctx, "hdl")?.measuredAt },
      { label: "TFGe", value: String(egfr).replace(".", ","), unit: "mL/min/1,73 m²" },
      { label: "IMC", value: String(bmi).replace(".", ",") },
      { label: "Diabetes", value: dm ? "sim" : "não" },
      { label: "Tabagismo", value: smoke ? "sim" : "não" },
    ],
    staleWarnings: [],
    inputs: {
      idade: age, sexo: sex, pas: sbp, colesterol_total: chol, hdl, diabetes: dm, tabagismo: smoke, tfge: egfr, imc: bmi,
    },
    outputs: { aplicavel: true, risco_numerico: null, ferramenta: "AHA PREVENT oficial" },
  };
}
