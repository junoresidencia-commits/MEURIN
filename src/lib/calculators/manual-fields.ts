/** Campos manuais por ferramenta. Client-safe. */

export type ManualField = {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "bool";
  options?: { value: string; label: string }[];
};

const sex: ManualField = {
  key: "sexo",
  label: "Sexo",
  type: "select",
  options: [
    { value: "female", label: "Feminino" },
    { value: "male", label: "Masculino" },
  ],
};

export const MANUAL_FIELDS: Record<string, ManualField[]> = {
  ckd_epi_cr_2021: [
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
  ],
  ckd_epi_cys_2021: [
    { key: "cistatina_c", label: "Cistatina C (mg/L)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
  ],
  ckd_epi_cr_cys_2021: [
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "cistatina_c", label: "Cistatina C (mg/L)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
  ],
  kdigo_ga: [
    { key: "tfge", label: "TFGe (mL/min/1,73 m²) — opcional se houver creatinina", type: "number" },
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
    { key: "rac", label: "RAC / ACR (mg/g)", type: "number" },
  ],
  cockcroft_gault: [
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
    { key: "peso_kg", label: "Peso (kg)", type: "number" },
  ],
  kfre_4var: [
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
    { key: "tfge", label: "TFGe (opcional se houver creatinina)", type: "number" },
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "rac", label: "ACR (mg/g)", type: "number" },
    { key: "em_trs", label: "Já em diálise/transplante?", type: "bool" },
  ],
  prevent: [
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
    { key: "pas", label: "PAS (mmHg)", type: "number" },
    { key: "colesterol_total", label: "Colesterol total (mg/dL)", type: "number" },
    { key: "hdl", label: "HDL (mg/dL)", type: "number" },
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "peso_kg", label: "Peso (kg)", type: "number" },
    { key: "altura_cm", label: "Altura (cm)", type: "number" },
    { key: "diabetes", label: "Diabetes", type: "bool" },
    { key: "tabagismo", label: "Tabagismo atual", type: "bool" },
    { key: "dcv_conhecida", label: "DCV conhecida", type: "bool" },
  ],
  renal_dose: [
    { key: "farmaco", label: "Medicamento (ex.: Ciprofloxacino)", type: "text" },
    { key: "dose_atual", label: "Dose atual", type: "text" },
    { key: "freq_atual", label: "Frequência atual", type: "text" },
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    { key: "idade", label: "Idade (anos)", type: "number" },
    sex,
    { key: "peso_kg", label: "Peso (kg) — para Cockcroft-Gault", type: "number" },
    { key: "em_trs", label: "Em diálise/TRS?", type: "bool" },
  ],
  polypharmacy: [{ key: "medicamentos", label: "Medicamentos (um por linha)", type: "text" }],
  geriatric_med_review: [
    { key: "idade", label: "Idade (anos)", type: "number" },
    { key: "medicamentos", label: "Medicamentos (um por linha)", type: "text" },
    { key: "creatinina", label: "Creatinina (mg/dL)", type: "number" },
    sex,
  ],
  urr: [
    { key: "ureia_pre", label: "Ureia pré (mg/dL)", type: "number" },
    { key: "ureia_pos", label: "Ureia pós (mg/dL)", type: "number" },
  ],
  ktv_daugirdas: [
    { key: "ureia_pre", label: "Ureia pré (mg/dL)", type: "number" },
    { key: "ureia_pos", label: "Ureia pós (mg/dL)", type: "number" },
    { key: "horas", label: "Tempo da sessão (horas)", type: "number" },
    { key: "uf_kg", label: "UF (kg) — opcional", type: "number" },
    { key: "peso_kg", label: "Peso (kg) — opcional", type: "number" },
  ],
  anion_gap: [
    { key: "sodio", label: "Sódio (mEq/L)", type: "number" },
    { key: "cloro", label: "Cloro (mEq/L)", type: "number" },
    { key: "bicarbonato", label: "Bicarbonato (mEq/L)", type: "number" },
    { key: "albumina", label: "Albumina (g/dL) — para correção", type: "number" },
  ],
  delta_gap: [
    { key: "sodio", label: "Sódio (mEq/L)", type: "number" },
    { key: "cloro", label: "Cloro (mEq/L)", type: "number" },
    { key: "bicarbonato", label: "Bicarbonato (mEq/L)", type: "number" },
  ],
  na_corrected_glucose: [
    { key: "sodio", label: "Sódio (mEq/L)", type: "number" },
    { key: "glicemia", label: "Glicose (mg/dL)", type: "number" },
  ],
  osm_calculated: [
    { key: "sodio", label: "Sódio (mEq/L)", type: "number" },
    { key: "glicemia", label: "Glicose (mg/dL)", type: "number" },
    { key: "ureia", label: "Ureia (mg/dL)", type: "number" },
    { key: "osm_medida", label: "Osm medida — para o gap", type: "number" },
  ],
  ca_corrected: [
    { key: "calcio", label: "Cálcio total (mg/dL)", type: "number" },
    { key: "albumina", label: "Albumina (g/dL)", type: "number" },
  ],
  fena: [
    { key: "una", label: "Na urinário", type: "number" },
    { key: "sodio", label: "Na plasmático", type: "number" },
    { key: "ucr", label: "Cr urinária", type: "number" },
    { key: "creatinina", label: "Cr plasmática", type: "number" },
  ],
  feureia: [
    { key: "uureia", label: "Ureia urinária", type: "number" },
    { key: "ureia", label: "Ureia plasmática", type: "number" },
    { key: "ucr", label: "Cr urinária", type: "number" },
    { key: "creatinina", label: "Cr plasmática", type: "number" },
  ],
  cfs: [
    { key: "cfs_score", label: "Escore CFS (1–9) após avaliação", type: "number" },
    { key: "cfs_by", label: "Avaliado por", type: "text" },
    { key: "cfs_context", label: "Contexto", type: "text" },
    { key: "cfs_note", label: "Observação", type: "text" },
  ],
  function_basic: [
    { key: "abvd", label: "ABVD", type: "text" },
    { key: "aivd", label: "AIVD", type: "text" },
    { key: "mobilidade", label: "Mobilidade", type: "text" },
    { key: "dependencia", label: "Dependência", type: "text" },
    { key: "cuidador", label: "Necessidade de cuidador", type: "text" },
  ],
  geriatric_prognosis: [{ key: "indice", label: "Id do índice (vazio = nenhum cadastrado)", type: "text" }],
  spict: [
    { key: "spict_avaliado", label: "Avaliação dos indicadores feita?", type: "bool" },
    { key: "spict_indicadores", label: "Indicadores presentes (instrumento oficial)?", type: "bool" },
    { key: "spict_note", label: "Observação", type: "text" },
  ],
  necpal: [
    { key: "necpal_avaliado", label: "Avaliação feita?", type: "bool" },
    { key: "necpal_surpresa_nao", label: "Não se surpreenderia com óbito em ~12 meses?", type: "bool" },
    { key: "necpal_indicadores", label: "Indicadores de doença avançada?", type: "bool" },
    { key: "necpal_note", label: "Observação", type: "text" },
  ],
  pps: [
    { key: "pps_score", label: "Escore PPS (0–100) obtido no instrumento oficial", type: "number" },
    { key: "pps_anterior", label: "PPS anterior (opcional)", type: "number" },
  ],
};
