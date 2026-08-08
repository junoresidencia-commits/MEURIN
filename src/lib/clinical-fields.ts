/**
 * Definições de variáveis clínicas estruturadas (client-safe).
 * Arquitetura extensível: acrescentar um item aqui já reflete no editor de
 * Perfil clínico, no Dicionário de dados, no construtor de coortes e na exportação.
 *
 * Princípio de pesquisa: campo vazio NÃO é "não" — é "desconhecido".
 */

export type TriState = "sim" | "nao" | "desconhecido";
export const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "desconhecido", label: "Desconhecido" },
];

export const ESTAGIOS_G = ["G1", "G2", "G3a", "G3b", "G4", "G5"] as const;
export const CATEGORIAS_A = ["A1", "A2", "A3"] as const;

export const ETIOLOGIAS: { value: string; label: string }[] = [
  { value: "doenca_renal_diabetica", label: "Doença renal diabética" },
  { value: "nefroesclerose_hipertensiva", label: "Nefroesclerose hipertensiva" },
  { value: "glomerulopatia", label: "Glomerulopatia" },
  { value: "doenca_renal_policistica", label: "Doença renal policística" },
  { value: "doenca_hereditaria", label: "Doença hereditária" },
  { value: "uropatia_obstrutiva", label: "Uropatia obstrutiva" },
  { value: "nefropatia_tubulointersticial", label: "Nefropatia tubulointersticial" },
  { value: "doenca_vascular", label: "Doença vascular" },
  { value: "doenca_autoimune", label: "Doença autoimune" },
  { value: "neoplasia", label: "Neoplasia" },
  { value: "rim_unico", label: "Rim único" },
  { value: "multifatorial", label: "Causa multifatorial" },
  { value: "indeterminada", label: "Indeterminada" },
  { value: "outras", label: "Outras" },
];

export type FieldKind = "tri" | "enumG" | "enumA" | "etiologia" | "etiologiaMulti" | "number";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  group: string;
  unit?: string;
  /** Descrição para o Dicionário de dados. */
  description?: string;
}

export const CLINICAL_FIELDS: FieldDef[] = [
  // Dados gerais
  { key: "peso_kg", label: "Peso", kind: "number", group: "Dados gerais", unit: "kg" },
  { key: "altura_cm", label: "Altura", kind: "number", group: "Dados gerais", unit: "cm" },
  { key: "tabagismo", label: "Tabagismo", kind: "tri", group: "Dados gerais" },
  // Comorbidades
  { key: "has", label: "Hipertensão (HAS)", kind: "tri", group: "Comorbidades" },
  { key: "dm", label: "Diabetes (DM)", kind: "tri", group: "Comorbidades" },
  { key: "tempo_dm_anos", label: "Tempo de diabetes", kind: "number", group: "Comorbidades", unit: "anos" },
  { key: "ic", label: "Insuficiência cardíaca", kind: "tri", group: "Comorbidades" },
  { key: "dcv", label: "Doença cardiovascular", kind: "tri", group: "Comorbidades" },
  { key: "obesidade", label: "Obesidade", kind: "tri", group: "Comorbidades" },
  { key: "dislipidemia", label: "Dislipidemia", kind: "tri", group: "Comorbidades" },
  { key: "hepatopatia", label: "Doença hepática", kind: "tri", group: "Comorbidades" },
  { key: "neoplasia", label: "Neoplasia", kind: "tri", group: "Comorbidades" },
  // Doença renal
  { key: "drc", label: "DRC", kind: "tri", group: "Doença renal" },
  { key: "estagio_g", label: "Estágio (G)", kind: "enumG", group: "Doença renal" },
  { key: "categoria_a", label: "Categoria de albuminúria (A)", kind: "enumA", group: "Doença renal" },
  { key: "etiologia_principal", label: "Etiologia principal", kind: "etiologia", group: "Doença renal" },
  { key: "etiologias_associadas", label: "Etiologias associadas", kind: "etiologiaMulti", group: "Doença renal" },
  { key: "ira_previa", label: "IRA prévia", kind: "tri", group: "Doença renal" },
  { key: "rim_unico", label: "Rim único", kind: "tri", group: "Doença renal" },
  { key: "policistica", label: "Doença renal policística", kind: "tri", group: "Doença renal" },
  { key: "glomerulopatia", label: "Glomerulopatia", kind: "tri", group: "Doença renal" },
  { key: "hereditaria", label: "Nefropatia hereditária", kind: "tri", group: "Doença renal" },
  { key: "litiase", label: "Nefrolitíase", kind: "tri", group: "Doença renal" },
  { key: "uropatia_obstrutiva", label: "Uropatia obstrutiva", kind: "tri", group: "Doença renal" },
  { key: "transplante", label: "Transplante renal", kind: "tri", group: "Doença renal" },
  { key: "hemodialise", label: "Hemodiálise", kind: "tri", group: "Doença renal" },
  { key: "dialise_peritoneal", label: "Diálise peritoneal", kind: "tri", group: "Doença renal" },
];

export const CLINICAL_GROUPS = ["Dados gerais", "Comorbidades", "Doença renal"];

export function etiologiaLabel(v?: string | null): string {
  return ETIOLOGIAS.find((e) => e.value === v)?.label || v || "";
}

/** Tipo do valor de perfil (client + server). Valores ausentes ficam indefinidos = "desconhecido". */
export type ClinicalProfileData = Record<string, unknown>;

export function computeImc(data: ClinicalProfileData): number | null {
  const peso = Number(data.peso_kg);
  const alturaCm = Number(data.altura_cm);
  if (!Number.isFinite(peso) || !Number.isFinite(alturaCm) || alturaCm <= 0) return null;
  const m = alturaCm / 100;
  return Math.round((peso / (m * m)) * 10) / 10;
}
