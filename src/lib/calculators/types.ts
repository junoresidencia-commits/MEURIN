/** Tipos do módulo Calculadoras & Risco. Client-safe. */

export type CalcSection =
  | "rim"
  | "cardiovascular"
  | "medicamentos"
  | "geriatria"
  | "suporte"
  | "hemodialise"
  | "eletrolitos";

export type CalcStatus = "ok" | "missing" | "not_applicable" | "needs_clinical" | "recorded";

export type CalcValue = {
  label: string;
  value: string;
  unit?: string;
  date?: string | null;
  daysOld?: number | null;
};

export type CalcResult = {
  toolId: string;
  section: CalcSection;
  title: string;
  status: CalcStatus;
  headline: string;
  explanation: string;
  missing: string[];
  values: CalcValue[];
  staleWarnings: string[];
  formula: string;
  source: string;
  version: string;
  published: string;
  population: string;
  limitations: string;
  officialUrl?: string;
  inputs: Record<string, string | number | boolean | null>;
  outputs: Record<string, string | number | boolean | null>;
};

export type CalcContext = {
  patientName?: string | null;
  ageYears: number | null;
  sex: "male" | "female" | null;
  birthdate?: string | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  onKrt: boolean;
  knownCvd: boolean;
  diabetes: boolean | null;
  smoking: boolean | null;
  antihypertensive: boolean | null;
  statin: boolean | null;
  meds: string[];
  medsRaw: string;
  labs: Record<string, { value: number; unit?: string | null; measuredAt: string }>;
  sbp: number | null;
  dbp: number | null;
  bpAt: string | null;
  extra: Record<string, number | string | boolean | null>;
};

export type ManualOverrides = Partial<Record<string, string | number | boolean | null>>;
