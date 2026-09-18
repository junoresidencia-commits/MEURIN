import type { ClinicCashOrigin, ClinicExpenseCategory, ClinicExpenseMethod } from "./platform-types";

export const EXPENSE_CATEGORY_LABEL: Record<ClinicExpenseCategory, string> = {
  material_medico: "Material médico",
  material_escritorio: "Material de escritório",
  limpeza: "Limpeza",
  medicamentos: "Medicamentos",
  manutencao: "Manutenção",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  pagamento_funcionario: "Pagamento de funcionário/prestador",
  taxas: "Taxas",
  outros: "Outros",
};

export const EXPENSE_METHOD_LABEL: Record<ClinicExpenseMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferência",
  outro: "Outro",
};

export const CASH_ORIGIN_LABEL: Record<ClinicCashOrigin, string> = {
  caixa_fisico: "Caixa físico",
  conta_clinica: "Conta da clínica",
  pix_clinica: "PIX da clínica",
  outro: "Outro",
};

export const NFSE_STATUS_LABEL: Record<string, string> = {
  not_requested: "Não solicitada",
  pending: "Pendente",
  issuing: "Emitindo",
  issued: "Emitida",
  error: "Erro na emissão",
  cancelled: "Cancelada",
};

export const CASH_PERM_LABEL: Record<string, string> = {
  expense: "Registrar despesa",
  close_cash: "Fechar caixa",
  receipt: "Gerar recibo",
  nfse_request: "Solicitar nota",
  finance_view: "Ver fluxo de caixa",
};
