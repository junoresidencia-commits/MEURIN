import type { ClinicStockPermKey } from "./platform-types";

export const STOCK_CATEGORY_PRESETS = [
  "material_medico",
  "material_enfermagem",
  "medicamentos",
  "material_escritorio",
  "limpeza",
  "higiene",
  "equipamentos",
  "impressos",
  "outros",
] as const;

export const STOCK_CATEGORY_LABEL: Record<string, string> = {
  material_medico: "Material médico",
  material_enfermagem: "Material de enfermagem",
  medicamentos: "Medicamentos",
  material_escritorio: "Material de escritório",
  limpeza: "Limpeza",
  higiene: "Higiene",
  equipamentos: "Equipamentos",
  impressos: "Impressos",
  outros: "Outros",
};

export const STOCK_UNIT_PRESETS = ["unidade", "caixa", "pacote", "frasco", "rolo", "kit", "outro"] as const;

export const STOCK_UNIT_LABEL: Record<string, string> = {
  unidade: "Unidade",
  caixa: "Caixa",
  pacote: "Pacote",
  frasco: "Frasco",
  rolo: "Rolo",
  kit: "Kit",
  outro: "Outro",
};

export const STOCK_OUT_REASONS = [
  "uso_clinica",
  "uso_procedimento",
  "perda",
  "vencido",
  "danificado",
  "transferencia",
  "ajuste",
  "outro",
] as const;

export const STOCK_OUT_REASON_LABEL: Record<string, string> = {
  uso_clinica: "Uso da clínica",
  uso_procedimento: "Uso em procedimento",
  perda: "Perda",
  vencido: "Produto vencido",
  danificado: "Danificado",
  transferencia: "Transferência",
  ajuste: "Ajuste de estoque",
  outro: "Outro",
};

export const STOCK_ADJUST_REASONS = [
  "erro_contagem",
  "uso_nao_registrado",
  "perda",
  "vencimento",
  "outro",
] as const;

export const STOCK_ADJUST_REASON_LABEL: Record<string, string> = {
  erro_contagem: "Erro de contagem",
  uso_nao_registrado: "Material utilizado e não registrado",
  perda: "Perda",
  vencimento: "Vencimento",
  outro: "Outro",
};

export const STOCK_REQUEST_PRIORITY = ["normal", "urgente", "critica"] as const;
export const STOCK_REQUEST_PRIORITY_LABEL: Record<string, string> = {
  normal: "Normal",
  urgente: "Urgente",
  critica: "Crítica",
};

export const STOCK_REQUEST_STATUS = ["solicitado", "aprovado", "comprado", "recebido", "cancelado"] as const;
export const STOCK_REQUEST_STATUS_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  aprovado: "Aprovado",
  comprado: "Comprado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export const STOCK_PERM_LABEL: Record<ClinicStockPermKey, string> = {
  stock_view: "Ver estoque",
  stock_out: "Registrar saída de estoque",
  stock_in: "Registrar entrada/compra",
  stock_request: "Solicitar compra",
  stock_manage: "Cadastrar, ajustar e inventariar",
};

export type StockStatus = "normal" | "baixo" | "critico" | "zerado";

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  normal: "Normal",
  baixo: "Estoque baixo",
  critico: "Crítico",
  zerado: "Sem estoque",
};

export function stockStatus(qty: number, minQty: number): StockStatus {
  if (qty <= 0) return "zerado";
  if (minQty > 0 && qty <= minQty * 0.4) return "critico";
  if (minQty > 0 && qty <= minQty) return "baixo";
  return "normal";
}

export function categoryLabel(key: string) {
  return STOCK_CATEGORY_LABEL[key] || key;
}
export function unitLabel(key: string) {
  return STOCK_UNIT_LABEL[key] || key;
}
