/** Catálogo de exames laboratoriais com foco em nefrologia (client-safe). */
export type LabDef = { key: string; label: string; unit: string };

export const NEPHRO_LABS: LabDef[] = [
  { key: "creatinina", label: "Creatinina", unit: "mg/dL" },
  { key: "tfge", label: "TFGe", unit: "mL/min/1,73m²" },
  { key: "ureia", label: "Ureia", unit: "mg/dL" },
  { key: "potassio", label: "Potássio", unit: "mEq/L" },
  { key: "sodio", label: "Sódio", unit: "mEq/L" },
  { key: "calcio", label: "Cálcio", unit: "mg/dL" },
  { key: "fosforo", label: "Fósforo", unit: "mg/dL" },
  { key: "magnesio", label: "Magnésio", unit: "mg/dL" },
  { key: "bicarbonato", label: "Bicarbonato", unit: "mEq/L" },
  { key: "albumina", label: "Albumina", unit: "g/dL" },
  { key: "hemoglobina", label: "Hemoglobina", unit: "g/dL" },
  { key: "ferritina", label: "Ferritina", unit: "ng/mL" },
  { key: "sat_transferrina", label: "Sat. de transferrina", unit: "%" },
  { key: "pth", label: "PTH", unit: "pg/mL" },
  { key: "proteinuria_24h", label: "Proteinúria 24h", unit: "mg/24h" },
  { key: "rac", label: "Relação albumina/creatinina (RAC)", unit: "mg/g" },
  { key: "rpc", label: "Relação proteína/creatinina (RPC)", unit: "mg/g" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "glicemia", label: "Glicemia", unit: "mg/dL" },
];

const BY_KEY = new Map(NEPHRO_LABS.map((l) => [l.key, l]));

export function labLabel(key: string): string {
  return BY_KEY.get(key)?.label || key;
}
export function labUnit(key: string): string {
  return BY_KEY.get(key)?.unit || "";
}
