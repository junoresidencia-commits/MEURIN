/** Itens de treinamento de DP — seguro para importar no cliente. */
export type PdTrainingStatus = "treinado" | "reforco" | "pendente";

export const PD_TRAINING_ITEMS: { key: string; label: string }[] = [
  { key: "maos", label: "Higienização das mãos" },
  { key: "assepsia", label: "Técnica asséptica" },
  { key: "conexao", label: "Conexão/desconexão" },
  { key: "troca", label: "Troca da bolsa" },
  { key: "armazenamento", label: "Armazenamento" },
  { key: "efluente", label: "Reconhecimento de efluente turvo" },
  { key: "orificio", label: "Reconhecimento de infecção do orifício" },
  { key: "cateter", label: "Cuidados com cateter" },
  { key: "peso", label: "Controle de peso" },
  { key: "pa", label: "Controle de PA" },
  { key: "uf", label: "Registro de ultrafiltração" },
  { key: "quando", label: "Quando procurar atendimento" },
  { key: "intercorrencia", label: "Conduta em intercorrências" },
];
