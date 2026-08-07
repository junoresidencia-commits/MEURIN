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
  { key: "microalbuminuria", label: "Microalbuminúria", unit: "mg/L" },
  { key: "cistatina_c", label: "Cistatina C", unit: "mg/L" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "glicemia", label: "Glicemia", unit: "mg/dL" },
  { key: "glicemia_jejum", label: "Glicemia de jejum", unit: "mg/dL" },
  { key: "acido_urico", label: "Ácido úrico", unit: "mg/dL" },
  { key: "cloro", label: "Cloro", unit: "mEq/L" },
  { key: "calcio_ionico", label: "Cálcio iônico", unit: "mmol/L" },
  { key: "proteinas_totais", label: "Proteínas totais", unit: "g/dL" },
  { key: "ferro_serico", label: "Ferro sérico", unit: "µg/dL" },
  { key: "hematocrito", label: "Hematócrito", unit: "%" },
  { key: "leucocitos", label: "Leucócitos", unit: "/mm³" },
  { key: "plaquetas", label: "Plaquetas", unit: "/mm³" },
  { key: "vhs", label: "VHS", unit: "mm/h" },
  { key: "pcr", label: "Proteína C reativa (PCR)", unit: "mg/L" },
  { key: "colesterol_total", label: "Colesterol total", unit: "mg/dL" },
  { key: "ldl", label: "LDL colesterol", unit: "mg/dL" },
  { key: "hdl", label: "HDL colesterol", unit: "mg/dL" },
  { key: "triglicerideos", label: "Triglicerídeos", unit: "mg/dL" },
  { key: "tgo", label: "TGO / AST", unit: "U/L" },
  { key: "tgp", label: "TGP / ALT", unit: "U/L" },
  { key: "ggt", label: "Gama-GT", unit: "U/L" },
  { key: "fosfatase_alcalina", label: "Fosfatase alcalina", unit: "U/L" },
  { key: "tsh", label: "TSH", unit: "µUI/mL" },
  { key: "t4_livre", label: "T4 livre", unit: "ng/dL" },
  { key: "vitamina_d", label: "Vitamina D (25-OH)", unit: "ng/mL" },
  { key: "vitamina_b12", label: "Vitamina B12", unit: "pg/mL" },
  { key: "inr", label: "INR (RNI)", unit: "" },
];

const BY_KEY = new Map(NEPHRO_LABS.map((l) => [l.key, l]));

export function labLabel(key: string): string {
  return BY_KEY.get(key)?.label || key;
}
export function labUnit(key: string): string {
  return BY_KEY.get(key)?.unit || "";
}
