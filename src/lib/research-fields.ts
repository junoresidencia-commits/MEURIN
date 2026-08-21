import { CLINICAL_FIELDS, ESTAGIOS_G, CATEGORIAS_A, ETIOLOGIAS } from "./clinical-fields";
import { NEPHRO_LABS, labUnit } from "./labs";

export type VarType = "num" | "cat" | "text";
export type Source = "informado" | "calculado" | "estruturado" | "laboratório";

export interface ResearchVar {
  key: string;
  label: string;
  type: VarType;
  group: string;
  source: Source;
  unit?: string;
  options?: { value: string; label: string }[];
  description?: string;
}

const TRI_OPTS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "desconhecido", label: "Desconhecido" },
];

function profileVar(): ResearchVar[] {
  return CLINICAL_FIELDS.map((f) => {
    if (f.kind === "number") {
      return { key: f.key, label: f.label, type: "num" as const, group: f.group, source: "informado" as const, unit: f.unit };
    }
    if (f.kind === "enumG") {
      return { key: f.key, label: f.label, type: "cat" as const, group: f.group, source: "estruturado" as const, options: ESTAGIOS_G.map((v) => ({ value: v, label: v })) };
    }
    if (f.kind === "enumA") {
      return { key: f.key, label: f.label, type: "cat" as const, group: f.group, source: "estruturado" as const, options: CATEGORIAS_A.map((v) => ({ value: v, label: v })) };
    }
    if (f.kind === "etiologia" || f.kind === "etiologiaMulti") {
      return { key: f.key, label: f.label, type: "cat" as const, group: f.group, source: "estruturado" as const, options: ETIOLOGIAS };
    }
    if (f.kind === "text") {
      return { key: f.key, label: f.label, type: "text" as const, group: f.group, source: "informado" as const, description: f.description };
    }
    // tri
    return { key: f.key, label: f.label, type: "cat" as const, group: f.group, source: "estruturado" as const, options: TRI_OPTS };
  });
}

const DERIVED: ResearchVar[] = [
  { key: "idade", label: "Idade", type: "num", group: "Demografia", source: "calculado", unit: "anos", description: "Calculada a partir da data de nascimento." },
  { key: "sexo", label: "Sexo", type: "cat", group: "Demografia", source: "informado", options: [
    { value: "masculino", label: "Masculino" },
    { value: "feminino", label: "Feminino" },
    { value: "desconhecido", label: "Desconhecido" },
  ] },
  { key: "cidade", label: "Cidade", type: "text", group: "Demografia", source: "informado" },
  { key: "imc", label: "IMC", type: "num", group: "Dados gerais", source: "calculado", unit: "kg/m²", description: "Peso / altura²." },
];

const LAB_VARS: ResearchVar[] = NEPHRO_LABS.map((l) => ({
  key: `lab_${l.key}`,
  label: `${l.label} (último)`,
  type: "num" as const,
  group: "Laboratório (último valor)",
  source: "laboratório" as const,
  unit: labUnit(l.key),
  description: "Valor mais recente registrado no histórico laboratorial.",
}));

export const RESEARCH_VARS: ResearchVar[] = [...DERIVED, ...profileVar(), ...LAB_VARS];
export const RESEARCH_VARS_BY_KEY = new Map(RESEARCH_VARS.map((v) => [v.key, v]));

export const RESEARCH_GROUPS = Array.from(new Set(RESEARCH_VARS.map((v) => v.group)));

export type Operator = "=" | "!=" | ">" | "<" | "entre";
export const OPERATORS_NUM: Operator[] = ["=", "!=", ">", "<", "entre"];
export const OPERATORS_CAT: Operator[] = ["=", "!="];
