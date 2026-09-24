import type { HdAlertLevel, HdExamCode, HdPermKey, HdRole, HdShift, HdWeekdayGroup } from "./hd-types";

export const HD_ROLE_LABEL: Record<HdRole, string> = {
  MEDICO: "Médico",
  ENFERMAGEM: "Enfermagem",
  LABORATORIO: "Laboratório",
  ADMIN: "Administrador da Hemodiálise",
};

export const HD_SHIFT_LABEL: Record<HdShift, string> = {
  MANHA: "1º turno",
  TARDE: "2º turno",
  NOITE: "3º turno",
};

export const HD_SHIFT_LONG: Record<HdShift, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
};

export const HD_WEEKDAY_LABEL: Record<HdWeekdayGroup, string> = {
  SEG_QUA_SEX: "Segunda | Quarta | Sexta",
  TER_QUI_SAB: "Terça | Quinta | Sábado",
};

export const HD_PERM_LABEL: Record<HdPermKey, string> = {
  view_patients: "Ver pacientes",
  view_exams: "Ver exames",
  upload_exams: "Enviar exames",
  confirm_ocr: "Confirmar leitura",
  view_map: "Ver mapa",
  edit_access: "Editar acesso",
  edit_machine: "Editar máquina",
  edit_shift: "Editar turno",
  edit_time: "Editar tempo",
  edit_capillary: "Editar capilar",
  edit_heparin: "Editar heparina",
  edit_prescription: "Editar prescrição médica",
  review: "Revisar e decidir",
  close_month: "Fechar mês",
  view_history: "Ver histórico",
  view_audit: "Ver auditoria",
  manage_team: "Gerenciar equipe",
  manage_config: "Configurar módulo",
  edit_protocols: "Editar protocolos",
};

export const HD_EXAM_LABEL: Record<HdExamCode, string> = {
  hb: "Hemoglobina",
  ht: "Hematócrito",
  ferritin: "Ferritina",
  tsat: "TSAT",
  serum_iron: "Ferro sérico",
  ca: "Cálcio",
  p: "Fósforo",
  pth: "PTH",
  k: "Potássio",
  albumin: "Albumina",
  hco3: "Bicarbonato",
  urea_pre: "Ureia pré",
  urea_post: "Ureia pós",
  creat: "Creatinina",
  na: "Sódio",
};

export const HD_EXAM_UNIT: Record<HdExamCode, string> = {
  hb: "g/dL",
  ht: "%",
  ferritin: "ng/mL",
  tsat: "%",
  serum_iron: "µg/dL",
  ca: "mg/dL",
  p: "mg/dL",
  pth: "pg/mL",
  k: "mEq/L",
  albumin: "g/dL",
  hco3: "mEq/L",
  urea_pre: "mg/dL",
  urea_post: "mg/dL",
  creat: "mg/dL",
  na: "mEq/L",
};

export const HD_ALERT_LABEL: Record<HdAlertLevel, string> = {
  OK: "OK",
  REVISAR: "Revisar",
  CRITICO: "Crítico",
};

export const HD_NAV = [
  { href: "/hemodialise/inicio", label: "Início" },
  { href: "/hemodialise/pacientes", label: "Pacientes" },
  { href: "/hemodialise/exames", label: "Exames" },
  { href: "/hemodialise/revisao", label: "Revisão" },
  { href: "/hemodialise/mapa", label: "Mapa" },
  { href: "/hemodialise/equipe", label: "Equipe" },
  { href: "/hemodialise/historico", label: "Histórico" },
  { href: "/hemodialise/configuracoes", label: "Configurações" },
] as const;

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] || month} ${year}`;
}
