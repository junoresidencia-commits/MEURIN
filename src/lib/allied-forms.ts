/** Campos de anamnese/avaliação — usados no cliente e para montar o texto da nota. */

export const PSY_ANAMNESIS: { key: string; label: string }[] = [
  { key: "motivo", label: "Motivo do acompanhamento" },
  { key: "demanda", label: "Demanda principal" },
  { key: "historico", label: "Histórico" },
  { key: "adaptacao", label: "Adaptação ao diagnóstico" },
  { key: "impacto", label: "Impacto da doença" },
  { key: "ansiedade", label: "Ansiedade" },
  { key: "humor", label: "Humor" },
  { key: "sono", label: "Sono" },
  { key: "adesao", label: "Adesão ao tratamento" },
  { key: "relacao_dieta_meds", label: "Relação com dieta e medicamentos" },
  { key: "rede_apoio", label: "Rede de apoio" },
  { key: "familia", label: "Família" },
  { key: "trabalho", label: "Trabalho" },
  { key: "rotina", label: "Rotina" },
  { key: "qualidade_vida", label: "Qualidade de vida" },
  { key: "observacoes", label: "Observações" },
];

export const NURSE_ASSESSMENT: { key: string; label: string }[] = [
  { key: "peso", label: "Peso" },
  { key: "pa", label: "Pressão arterial" },
  { key: "fc", label: "Frequência cardíaca" },
  { key: "temperatura", label: "Temperatura" },
  { key: "saturacao", label: "Saturação" },
  { key: "glicemia", label: "Glicemia" },
  { key: "edema", label: "Edema" },
  { key: "diurese", label: "Diurese" },
  { key: "estado_geral", label: "Estado geral" },
  { key: "acessos", label: "Acessos" },
  { key: "cateteres", label: "Cateteres" },
  { key: "feridas", label: "Feridas" },
  { key: "adesao", label: "Adesão medicamentosa" },
  { key: "sintomas", label: "Sintomas" },
  { key: "intercorrencias", label: "Intercorrências" },
  { key: "orientacoes", label: "Orientações" },
  { key: "observacoes", label: "Observações" },
];

export function payloadToBody(fields: { key: string; label: string }[], payload: Record<string, string>): string {
  return fields
    .map((f) => {
      const v = (payload[f.key] || "").trim();
      return v ? `${f.label}: ${v}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
