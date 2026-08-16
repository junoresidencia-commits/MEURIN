// Rótulos e tipos compartilhados das páginas de Pesquisa Científica (client-safe).

export type StudyType =
  | "relato_caso" | "serie_casos" | "transversal" | "coorte_retro" | "coorte_prosp"
  | "caso_controle" | "observacional" | "revisao_narrativa" | "revisao_integrativa"
  | "revisao_sistematica" | "metanalise" | "projeto_livre";

export type StudyStatus = "rascunho" | "coleta" | "analise" | "escrita" | "submetido" | "concluido";

export type StudyLite = {
  id: string;
  type: StudyType;
  title: string;
  question: string;
  status: StudyStatus;
  variables?: string[];
  filters?: { field: string; op: string; value: string; value2?: string }[];
  journal?: string | null;
};

export const STUDY_TYPE_LABEL: Record<string, string> = {
  relato_caso: "Relato de caso",
  serie_casos: "Série de casos",
  transversal: "Estudo transversal",
  coorte_retro: "Coorte retrospectiva",
  coorte_prosp: "Coorte prospectiva",
  caso_controle: "Caso-controle",
  observacional: "Estudo observacional",
  revisao_narrativa: "Revisão narrativa",
  revisao_integrativa: "Revisão integrativa",
  revisao_sistematica: "Revisão sistemática",
  metanalise: "Metanálise",
  projeto_livre: "Projeto livre",
};

export const STUDY_TYPES: StudyType[] = [
  "relato_caso", "serie_casos", "transversal", "coorte_retro", "coorte_prosp", "caso_controle",
  "observacional", "revisao_narrativa", "revisao_integrativa", "revisao_sistematica", "metanalise", "projeto_livre",
];

export const STUDY_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  coleta: "Coleta",
  analise: "Análise",
  escrita: "Escrita",
  submetido: "Submetido",
  concluido: "Concluído",
};

export const STUDY_STATUSES: StudyStatus[] = ["rascunho", "coleta", "analise", "escrita", "submetido", "concluido"];

export const CASE_CATEGORY_LABEL: Record<string, string> = {
  relato: "Possível relato de caso",
  serie: "Série de casos",
  raro: "Caso raro",
  discussao: "Caso para discussão",
  aula: "Caso para aula",
  artigo: "Caso para artigo",
  congresso: "Caso para congresso",
  longitudinal: "Acompanhamento longitudinal",
  pesquisa: "Possível inclusão em pesquisa",
};

export const CASE_CATEGORIES = Object.keys(CASE_CATEGORY_LABEL);
