/**
 * Preferências da inteligência clínica — client-safe.
 * Nunca automático: só sugere. O médico confirma o que entra no perfil.
 */

import { CLINICAL_FIELDS } from "./clinical-fields";
import type { DetectedField } from "./clinical-intelligence";

export const INTEL_MODULES = ["lifestyle", "meds", "comorbidities", "kidney", "urine"] as const;
export type IntelModule = (typeof INTEL_MODULES)[number];

export const INTEL_MODULE_LABEL: Record<IntelModule, string> = {
  lifestyle: "Hábitos e dados gerais",
  meds: "Medicamentos e alergias",
  comorbidities: "Comorbidades e CKM",
  kidney: "Doença renal (G/A/DRC)",
  urine: "Exame de urina (fita)",
};

export type IntelApplyMode = "review_only";

export type IntelligenceModules = Record<IntelModule, boolean>;

export type IntelligencePrefs = {
  enabled: boolean;
  applyMode: IntelApplyMode;
  modules: IntelligenceModules;
  allowBackfill: boolean;
  source: "default" | "clinic" | "doctor";
};

export const DEFAULT_INTEL_MODULES: IntelligenceModules = {
  lifestyle: true,
  meds: true,
  comorbidities: true,
  kidney: true,
  urine: true,
};

export const DEFAULT_INTEL_PREFS: IntelligencePrefs = {
  enabled: true,
  applyMode: "review_only",
  modules: { ...DEFAULT_INTEL_MODULES },
  allowBackfill: true,
  source: "default",
};

const GROUP_TO_MODULE: Record<string, IntelModule> = {
  "Dados gerais": "lifestyle",
  Comorbidades: "comorbidities",
  "Síndrome CKM": "comorbidities",
  "Doença renal": "kidney",
  "Exame de urina (fita)": "urine",
  Resumo: "lifestyle",
};

const KEY_TO_MODULE: Record<string, IntelModule> = {
  medicamentos_em_uso: "meds",
  medicamentos_suspensos: "meds",
  alergias: "meds",
  alergias_negadas: "meds",
};

for (const f of CLINICAL_FIELDS) {
  if (!KEY_TO_MODULE[f.key]) {
    KEY_TO_MODULE[f.key] = GROUP_TO_MODULE[f.group] || "lifestyle";
  }
}

export function moduleForField(key: string): IntelModule {
  return KEY_TO_MODULE[key] || "lifestyle";
}

export function mergeIntelPrefs(
  base: IntelligencePrefs,
  override: Partial<IntelligencePrefs> | null | undefined,
  source: IntelligencePrefs["source"]
): IntelligencePrefs {
  if (!override) return { ...base, modules: { ...base.modules } };
  return {
    enabled: override.enabled ?? base.enabled,
    applyMode: "review_only",
    modules: { ...base.modules, ...(override.modules || {}) },
    allowBackfill: override.allowBackfill ?? base.allowBackfill,
    source,
  };
}

/** Filtra o que pode aparecer na revisão. Nunca devolve lista para gravar sozinha. */
export function suggestForReview(detected: DetectedField[], prefs: IntelligencePrefs): DetectedField[] {
  if (!prefs.enabled) return [];
  return detected.filter((d) => {
    if (d.confidence === "baixa") return false;
    return prefs.modules[moduleForField(d.key)] !== false;
  });
}
