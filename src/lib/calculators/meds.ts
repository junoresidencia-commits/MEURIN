import { getTool } from "./catalog";
import { calcCkdEpiCr, calcCockcroftGault } from "./renal";
import type { CalcContext, CalcResult, ManualOverrides } from "./types";

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : null;
}

export type RenalMethod = "ckd_epi" | "cockcroft_gault" | "either";

export type RenalDrug = {
  id: string;
  names: string[];
  method: RenalMethod;
  reviewBelowEgfr: number | null;
  dialysisNote: string;
  guidance: string;
  source: string;
  version: string;
  reviewedAt: string;
};

/** Catálogo inicial — orientação cadastrada. Nunca altera a prescrição. */
export const RENAL_DRUGS: RenalDrug[] = [
  {
    id: "ciprofloxacino",
    names: ["ciprofloxacino", "ciprofloxacina", "cipro"],
    method: "cockcroft_gault",
    reviewBelowEgfr: 50,
    dialysisNote: "Em HD, dose após a sessão conforme indicação e bula.",
    guidance: "CrCl > 50: regime usual da indicação. CrCl 30–50: revisar intervalo (muitas indicações q18–24h). CrCl < 30 e diálise: ajustar e preferir dose pós-HD. Confira bula/ANVISA da apresentação.",
    source: "Bulas ANVISA / referências de ajuste renal — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "metformina",
    names: ["metformina", "glifage", "diformin"],
    method: "ckd_epi",
    reviewBelowEgfr: 45,
    dialysisNote: "Em TRS, metformina em geral não é usada — revisar indicação.",
    guidance: "TFGe ≥ 45: usualmente mantém com revisão. 30–44: reduzir/revisar. < 30 ou diálise: não iniciar; reavaliar manutenção. Risco de acidose láctica.",
    source: "Bula / consensos de DRC e diabetes — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "gabapentina",
    names: ["gabapentina", "neurontin"],
    method: "cockcroft_gault",
    reviewBelowEgfr: 60,
    dialysisNote: "Em HD, dose suplementar pós-sessão conforme bula.",
    guidance: "Reduzir dose diária conforme CrCl. Acúmulo causa sedação e mioclonia. Revisar se CrCl < 60.",
    source: "Bula — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "pregabalina",
    names: ["pregabalina", "lyrica"],
    method: "cockcroft_gault",
    reviewBelowEgfr: 60,
    dialysisNote: "Ajuste e dose pós-HD conforme bula.",
    guidance: "Ajustar à CrCl. Revisar se CrCl < 60.",
    source: "Bula — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "alopurinol",
    names: ["alopurinol", "allopurinol", "zyloric"],
    method: "ckd_epi",
    reviewBelowEgfr: 60,
    dialysisNote: "Em diálise, doses baixas e após sessão — revisar.",
    guidance: "Reduzir dose inicial na DRC. Hipersensibilidade é mais grave em TFGe baixa.",
    source: "Bula / prática nefrológica — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "enoxaparina",
    names: ["enoxaparina", "clexane"],
    method: "cockcroft_gault",
    reviewBelowEgfr: 30,
    dialysisNote: "Em HD o uso é específico — não aplicar a dose de profilaxia clínica automaticamente.",
    guidance: "CrCl < 30: reduzir dose (profilaxia e tratamento diferem). Preferir anti-Xa se disponível.",
    source: "Bula — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "aine",
    names: ["ibuprofeno", "diclofenaco", "nimesulida", "naproxeno", "cetoprofeno", "meloxicam", "piroxicam", "aine", "anti-inflamatório"],
    method: "ckd_epi",
    reviewBelowEgfr: 60,
    dialysisNote: "AINEs em TRS aumentam risco residual e GI — revisar.",
    guidance: "Evitar AINE na DRC quando possível. Revisar se TFGe < 60 ou albuminúria. Não suspender automaticamente — o médico decide.",
    source: "Prática nefrológica / KDIGO (princípio) — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "nitrofurantoina",
    names: ["nitrofurantoína", "nitrofurantoina", "macrodantina"],
    method: "ckd_epi",
    reviewBelowEgfr: 45,
    dialysisNote: "Não usar em TRS para ITU — concentração urinária insuficiente.",
    guidance: "TFGe < 45: eficácia urinária reduzida e risco de toxicidade. Revisar alternativa.",
    source: "Bula / critérios geriátricos comuns — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "espironolactona",
    names: ["espironolactona", "aldactone"],
    method: "ckd_epi",
    reviewBelowEgfr: 30,
    dialysisNote: "Em diálise o uso é pontual — hipercalemia. Revisar.",
    guidance: "TFGe < 30 ou K elevado: revisar. Não suspender sozinho se IC com indicação — o médico decide.",
    source: "Bula / prática — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "dapagliflozina",
    names: ["dapagliflozina", "forxiga", "empagliflozina", "jardiance", "canagliflozina"],
    method: "ckd_epi",
    reviewBelowEgfr: 25,
    dialysisNote: "Em TRS, iSGLT2 não é iniciado para glicemia; indicações cardiorrenais são decisão especializada.",
    guidance: "Não iniciar abaixo do limiar da bula (em geral TFGe < 20–25). Se já em uso, a manutenção é decisão clínica.",
    source: "Bulas / KDIGO diabetes — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "oseltamivir",
    names: ["oseltamivir", "tamiflu"],
    method: "cockcroft_gault",
    reviewBelowEgfr: 60,
    dialysisNote: "HD: regime específico pós-sessão — consultar bula.",
    guidance: "Ajustar dose e intervalo à CrCl. Tratamento ≠ profilaxia.",
    source: "Bula — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
  {
    id: "vancomicina",
    names: ["vancomicina"],
    method: "either",
    reviewBelowEgfr: 90,
    dialysisNote: "Em HD a dose é guiada por nível e tipo de membrana — não há dose única.",
    guidance: "Sempre revisar. Preferir níveis séricos. Não calcular dose automática neste módulo.",
    source: "Prática de monitorização — ficha Meu Rim",
    version: "2026-09",
    reviewedAt: "2026-09-25",
  },
];

export function findRenalDrug(query: string): RenalDrug | null {
  const q = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!q) return null;
  return (
    RENAL_DRUGS.find((d) =>
      d.names.some((n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || q.includes(n.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
    ) || null
  );
}

function kidneyFn(ctx: CalcContext, o: ManualOverrides, method: RenalMethod) {
  const epi = calcCkdEpiCr(ctx, o);
  const cg = calcCockcroftGault(ctx, o);
  const egfr = epi.status === "ok" ? Number(epi.outputs.tfge) : null;
  const crcl = cg.status === "ok" ? Number(cg.outputs.crcl) : null;
  if (method === "cockcroft_gault") {
    return { used: "Cockcroft-Gault (CrCl)", value: crcl, unit: "mL/min", alt: egfr, missing: crcl == null ? cg.missing : [], stale: cg.staleWarnings };
  }
  if (method === "ckd_epi") {
    return { used: "CKD-EPI 2021 (TFGe)", value: egfr, unit: "mL/min/1,73 m²", alt: crcl, missing: egfr == null ? epi.missing : [], stale: epi.staleWarnings };
  }
  const value = egfr ?? crcl;
  return {
    used: egfr != null ? "CKD-EPI 2021 (TFGe)" : crcl != null ? "Cockcroft-Gault (CrCl)" : "indefinido",
    value,
    unit: egfr != null ? "mL/min/1,73 m²" : "mL/min",
    alt: egfr != null ? crcl : null,
    missing: value == null ? Array.from(new Set([...epi.missing, ...cg.missing])) : [],
    stale: [...epi.staleWarnings, ...cg.staleWarnings],
  };
}

export function calcRenalDose(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("renal_dose")!;
  const q = String(o.farmaco || o.medicamento || ctx.extra.farmaco || "").trim();
  if (!q) {
    const hits = listPatientRenalFlags(ctx, o);
    if (!hits.length) {
      return {
        toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
        published: t.published, population: t.population, limitations: t.limitations,
        status: ctx.meds.length ? "ok" : "missing",
        headline: ctx.meds.length ? "Nenhum medicamento da lista atual bateu com ficha de ajuste renal." : "Não foi possível calcular — falta o nome do medicamento.",
        explanation: "Pesquise um fármaco (ex.: Ciprofloxacino) ou lance medicamentos no prontuário. O sistema nunca altera a prescrição.",
        missing: ctx.meds.length ? [] : ["medicamento"],
        values: [{ label: "Medicamentos ativos", value: String(ctx.meds.length) }],
        staleWarnings: [],
        inputs: { medicamentos: ctx.meds.join("; ") },
        outputs: { revisar: 0 },
      };
    }
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "ok",
      headline: `${hits.length} medicamento(s) necessitam revisão renal`,
      explanation: "O sistema identifica e apresenta recomendação. O médico decide. Nada foi alterado na prescrição.",
      missing: [],
      values: hits.map((h) => ({ label: h.drug, value: h.reason })),
      staleWarnings: hits.flatMap((h) => h.stale),
      inputs: { medicamentos: ctx.meds.join("; ") },
      outputs: { revisar: hits.length, itens: hits.map((h) => h.drug).join(", ") },
    };
  }

  const drug = findRenalDrug(q);
  if (!drug) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "missing",
      headline: `Não há ficha cadastrada para “${q}”.`,
      explanation: "Catálogo inicial. Sem ficha, não inventamos ajuste. Consulte a bula. O médico decide.",
      missing: ["ficha do fármaco"],
      values: [],
      staleWarnings: [],
      inputs: { farmaco: q },
      outputs: {},
    };
  }

  const kn = kidneyFn(ctx, o, drug.method);
  if (kn.value == null) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "missing",
      headline: `Não foi possível calcular — falta ${kn.missing.join(", ") || "função renal"}.`,
      explanation: `A ficha de ${drug.names[0]} usa ${kn.used === "indefinido" ? (drug.method === "cockcroft_gault" ? "Cockcroft-Gault" : "CKD-EPI") : kn.used}.`,
      missing: kn.missing,
      values: [],
      staleWarnings: kn.stale,
      inputs: { farmaco: q },
      outputs: {},
    };
  }

  const onDialysis = ctx.onKrt;
  const needsReview = onDialysis || (drug.reviewBelowEgfr != null && kn.value < drug.reviewBelowEgfr);
  const doseAtual = String(o.dose_atual || ctx.extra.dose_atual || "").trim();
  const freqAtual = String(o.freq_atual || ctx.extra.freq_atual || "").trim();

  return {
    toolId: t.id, section: t.section, title: drug.names[0][0].toUpperCase() + drug.names[0].slice(1), formula: t.formula,
    source: drug.source, version: drug.version, published: t.published, population: t.population, limitations: t.limitations,
    status: "ok",
    headline: needsReview ? "Revisar dose renal" : "Função renal acima do limiar cadastrado — ainda assim, o médico decide",
    explanation: "Fluxo: o sistema identifica → apresenta recomendação → o médico decide. Nada foi alterado na prescrição.",
    missing: [],
    values: [
      { label: "Dose atual", value: doseAtual || "não informada" },
      { label: "Frequência atual", value: freqAtual || "não informada" },
      { label: "Função renal utilizada", value: kn.value != null ? String(kn.value).replace(".", ",") : "—", unit: kn.unit },
      { label: "Método", value: kn.used },
      { label: "Diálise/TRS", value: onDialysis ? "sim" : "não" },
      { label: "Necessidade de revisão", value: needsReview ? "sim" : "não automaticamente" },
      { label: "Orientação da referência cadastrada", value: onDialysis ? `${drug.guidance} ${drug.dialysisNote}` : drug.guidance },
      { label: "Fonte", value: drug.source },
      { label: "Data/versão", value: `${drug.reviewedAt} · ${drug.version}` },
    ],
    staleWarnings: kn.stale,
    inputs: { farmaco: q, funcao: kn.value, metodo: kn.used, em_trs: onDialysis, dose_atual: doseAtual || null, freq_atual: freqAtual || null },
    outputs: { revisar: needsReview, farmaco: drug.id },
  };
}

export function listPatientRenalFlags(ctx: CalcContext, o: ManualOverrides = {}) {
  const hits: { drug: string; reason: string; stale: string[] }[] = [];
  for (const med of ctx.meds) {
    const drug = findRenalDrug(med);
    if (!drug) continue;
    const kn = kidneyFn(ctx, o, drug.method);
    if (kn.value == null) {
      hits.push({ drug: med, reason: `Falta ${kn.missing.join(", ") || "função renal"} para revisar`, stale: kn.stale });
      continue;
    }
    if (ctx.onKrt || (drug.reviewBelowEgfr != null && kn.value < drug.reviewBelowEgfr)) {
      hits.push({ drug: med, reason: `Revisar dose renal (${kn.used} ${String(kn.value).replace(".", ",")} ${kn.unit})`, stale: kn.stale });
    }
  }
  return hits;
}

export function calcPolypharmacy(ctx: CalcContext, _o: ManualOverrides = {}): CalcResult {
  const t = getTool("polypharmacy")!;
  const nMeds = ctx.meds.length;
  if (!nMeds && !ctx.medsRaw) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "missing",
      headline: "Não foi possível calcular — falta a lista de medicamentos.",
      explanation: "Sem lista no prontuário, não contamos. Não usamos regra “≥5 = retirar”.",
      missing: ["medicamentos em uso"],
      values: [],
      staleWarnings: [],
      inputs: {},
      outputs: {},
    };
  }
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "ok",
    headline: `Quantidade de medicamentos ativos: ${nMeds}`,
    explanation: "Sinal para revisão (função renal, idade, duplicidade, critérios geriátricos). Não significa retirar medicamentos.",
    missing: [],
    values: [
      { label: "Ativos", value: String(nMeds) },
      ...ctx.meds.slice(0, 20).map((m, i) => ({ label: `Item ${i + 1}`, value: m })),
    ],
    staleWarnings: [],
    inputs: { medicamentos: ctx.meds.join("; ") },
    outputs: { quantidade: nMeds },
  };
}

export type GeriatricAlert = {
  med: string;
  reason: string;
  rule: string;
  version: string;
  source: string;
};

export function geriatricAlerts(ctx: CalcContext, o: ManualOverrides = {}): GeriatricAlert[] {
  const epi = calcCkdEpiCr(ctx, o);
  const egfr = epi.status === "ok" ? Number(epi.outputs.tfge) : null;
  const age = n(o.idade) ?? ctx.ageYears;
  const alerts: GeriatricAlert[] = [];
  const v = "regras Meu Rim 2026-09";
  const src = "Regras próprias (estrutura STOPP/START) — não é o instrumento oficial";
  const text = ctx.meds.join(" | ").toLowerCase();

  const has = (re: RegExp) => ctx.meds.filter((m) => re.test(m));

  for (const m of has(/ibuprofeno|diclofenaco|nimesulida|naproxeno|cetoprofeno|meloxicam|piroxicam/i)) {
    if (egfr != null && egfr < 60) {
      alerts.push({ med: m, reason: "AINE em DRC (TFGe < 60) — revisar risco renal e GI.", rule: "MR-AINE-DRC", version: v, source: src });
    } else if (age != null && age >= 65) {
      alerts.push({ med: m, reason: "AINE em idoso — revisar risco renal, GI e CV.", rule: "MR-AINE-IDOSO", version: v, source: src });
    }
  }
  for (const m of has(/metformina/i)) {
    if (egfr != null && egfr < 30) {
      alerts.push({ med: m, reason: "Metformina com TFGe < 30 — revisar manutenção.", rule: "MR-METF-TFG", version: v, source: src });
    }
  }
  for (const m of has(/nitrofuranto[ií]na/i)) {
    if (egfr != null && egfr < 45) {
      alerts.push({ med: m, reason: "Nitrofurantoína com TFGe < 45 — eficácia/toxicidade. Revisar.", rule: "MR-NITRO-TFG", version: v, source: src });
    }
  }
  for (const m of has(/glibenclamida|gliburida/i)) {
    if (age != null && age >= 60) {
      alerts.push({ med: m, reason: "Sulfonilureia de ação longa em idoso — risco de hipoglicemia. Revisar.", rule: "MR-GLIB-IDOSO", version: v, source: src });
    }
  }
  for (const m of has(/espironolactona/i)) {
    if (egfr != null && egfr < 30) {
      alerts.push({ med: m, reason: "Espironolactona com TFGe < 30 — hipercalemia. Revisar.", rule: "MR-ESPIRO-TFG", version: v, source: src });
    }
  }
  const ieca = has(/enalapril|captopril|lisinopril|ramipril|perindopril|ieca/i);
  const bra = has(/losartana|valsartana|olmesartana|telmisartana|candesartana|irbesartana/i);
  if (ieca.length && bra.length) {
    alerts.push({
      med: `${ieca[0]} + ${bra[0]}`,
      reason: "Possível duplo bloqueio do SRAA. Revisar indicação.",
      rule: "MR-DUPLO-SRAA",
      version: v,
      source: src,
    });
  }
  const aines = has(/ibuprofeno|diclofenaco|nimesulida|naproxeno|cetoprofeno/);
  if (aines.length >= 2) {
    alerts.push({ med: aines.join(" + "), reason: "Possível duplicidade de AINE. Revisar.", rule: "MR-DUP-AINE", version: v, source: src });
  }
  if (age != null && age >= 60 && /diazepam|clonazepam|alprazolam|lorazepam|bromazepam/.test(text)) {
    const m = ctx.meds.find((x) => /diazepam|clonazepam|alprazolam|lorazepam|bromazepam/i.test(x)) || "benzodiazepínico";
    alerts.push({ med: m, reason: "Benzodiazepínico em idoso — queda e sedação. Revisar.", rule: "MR-BZD-IDOSO", version: v, source: src });
  }
  return alerts;
}

export function calcGeriatricMedReview(ctx: CalcContext, o: ManualOverrides = {}): CalcResult {
  const t = getTool("geriatric_med_review")!;
  const age = n(o.idade) ?? ctx.ageYears;
  if (age == null) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations, officialUrl: t.officialUrl,
      status: "missing",
      headline: "Não foi possível calcular — falta idade.",
      explanation: "Sem idade não aplicamos regras geriátricas. Não inventamos.",
      missing: ["idade"],
      values: [],
      staleWarnings: [],
      inputs: {},
      outputs: {},
    };
  }
  if (age < 60 && o.forcar_revisao !== true) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "not_applicable",
      headline: "Não aplicável a este paciente.",
      explanation: "Revisão geriátrica automática neste módulo é para ≥ 60 anos (ou quando o médico força a revisão).",
      missing: [],
      values: [{ label: "Idade", value: String(age) }],
      staleWarnings: [],
      inputs: { idade: age },
      outputs: {},
    };
  }
  if (!ctx.meds.length) {
    return {
      toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
      published: t.published, population: t.population, limitations: t.limitations,
      status: "missing",
      headline: "Não foi possível calcular — falta a lista de medicamentos.",
      explanation: "Sem lista, não há omissões/inapropriados a sinalizar.",
      missing: ["medicamentos em uso"],
      values: [],
      staleWarnings: [],
      inputs: { idade: age },
      outputs: {},
    };
  }
  const alerts = geriatricAlerts(ctx, o);
  return {
    toolId: t.id, section: t.section, title: t.title, formula: t.formula, source: t.source, version: t.version,
    published: t.published, population: t.population, limitations: t.limitations,
    status: "ok",
    headline: alerts.length ? `${alerts.length} alerta(s) geriátrico(s) — revisar` : "Nenhum alerta das regras cadastradas",
    explanation: "Resultado = Revisar. Nunca “suspender automaticamente”. Não é o instrumento STOPP/START oficial.",
    missing: [],
    values: alerts.length
      ? alerts.map((a) => ({ label: a.med, value: `${a.reason} · ${a.rule} · ${a.version}` }))
      : [{ label: "Alertas", value: "0" }],
    staleWarnings: [],
    inputs: { idade: age, medicamentos: ctx.meds.join("; ") },
    outputs: { alertas: alerts.length },
  };
}
