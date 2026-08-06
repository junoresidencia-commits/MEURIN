/**
 * Identificação oficial da plataforma (dados reais informados pelo controlador).
 * NÃO invente outros dados — os demais campos são preenchidos pelo administrador
 * em Configurações da empresa.
 */
export const COMPANY = {
  tradeName: "Meu Rim",
  legalName: "C.J. ATENDIMENTOS MEDICOS LTDA",
  cnpj: "33.103.963/0001-70",
  /** Linha oficial para rodapés, documentos legais e comprovantes. */
  controllerLine:
    "Meu Rim, plataforma disponibilizada por C.J. ATENDIMENTOS MEDICOS LTDA, inscrita no CNPJ sob o nº 33.103.963/0001-70.",
} as const;

/** Campos obrigatórios (preenchidos pelo admin) para liberar a publicação dos documentos legais. */
export const REQUIRED_COMPANY_FIELDS: { key: string; label: string }[] = [
  { key: "address", label: "Endereço completo" },
  { key: "city", label: "Município" },
  { key: "state", label: "Estado (UF)" },
  { key: "cep", label: "CEP" },
  { key: "supportEmail", label: "E-mail de suporte" },
  { key: "privacyEmail", label: "E-mail de privacidade" },
  { key: "supportPhone", label: "Telefone de suporte" },
  { key: "dpoContact", label: "Encarregado / canal de privacidade" },
  { key: "responsibleDoctorName", label: "Médico responsável" },
  { key: "responsibleDoctorCrm", label: "CRM do responsável" },
  { key: "responsibleDoctorUf", label: "UF do CRM do responsável" },
  { key: "documentIssuerData", label: "Dados para emissão de documentos" },
  { key: "cancellationPolicy", label: "Política de cancelamento" },
  { key: "suppliers", label: "Fornecedores utilizados" },
  { key: "storageLocation", label: "Localização do armazenamento" },
  { key: "retentionByCategory", label: "Prazos de conservação por categoria" },
];

export const OPTIONAL_COMPANY_FIELDS: { key: string; label: string }[] = [
  { key: "responsibleDoctorRqe", label: "RQE do responsável" },
];

export type CompanySettings = Record<string, string>;

export function missingRequiredCompanyFields(settings: CompanySettings): string[] {
  return REQUIRED_COMPANY_FIELDS.filter((f) => !String(settings[f.key] || "").trim()).map(
    (f) => f.label
  );
}
