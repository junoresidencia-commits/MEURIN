/**
 * Conteúdo educativo da área do paciente (client-safe), em linguagem leiga.
 * Filosofia: ENTENDER → ACOMPANHAR → REGISTRAR → COMPARTILHAR → CUIDAR.
 * Não substitui médico, nutricionista ou atendimento presencial.
 */

export type EduTag = "geral" | "diabetes" | "hipertensao" | "drc" | "litiase" | "glomerulopatia" | "transplante";

export interface EduTopic {
  id: string;
  title: string;
  body: string[]; // parágrafos curtos
  tags: EduTag[];
}

/** Cards de destaque — as mensagens mais importantes (mitos que precisam ser desfeitos). */
export const EDU_HIGHLIGHTS: EduTopic[] = [
  {
    id: "ultrassom-normal",
    title: "Meu ultrassom dos rins veio normal. Então meus rins estão normais?",
    body: [
      "Não necessariamente.",
      "O ultrassom mostra principalmente a estrutura dos rins: tamanho, formato, pedras, cistos e dilatações.",
      "Ele não consegue mostrar todas as doenças que acontecem dentro dos pequenos filtros do rim.",
      "É possível ter doença renal crônica, perda de proteína na urina ou redução da função renal mesmo com um ultrassom aparentemente normal.",
      "Ultrassom normal não afasta doença renal crônica.",
    ],
    tags: ["geral", "drc"],
  },
  {
    id: "sumario-normal",
    title: "Meu exame comum de urina veio normal. Então não tenho proteína na urina?",
    body: [
      "Não necessariamente.",
      "O exame comum de urina (sumário ou urina tipo 1) é útil, mas pode não identificar pequenas quantidades de albumina.",
      "Por isso, dependendo do caso, o médico pode pedir exames mais sensíveis, como a relação albumina/creatinina (RAC).",
      "Uma pessoa pode ter um sumário aparentemente normal e mesmo assim apresentar albuminúria.",
    ],
    tags: ["geral", "diabetes", "glomerulopatia"],
  },
  {
    id: "funcao-vs-lesao",
    title: "Posso ter doença renal mesmo com a taxa de filtração normal?",
    body: [
      "Sim.",
      "Algumas doenças renais começam causando perda de proteína, albumina ou sangue na urina antes de reduzir a taxa de filtração.",
      "Por isso, avaliar o rim não é olhar apenas a creatinina.",
      "Função renal e lesão renal não são a mesma coisa.",
    ],
    tags: ["geral", "drc", "glomerulopatia"],
  },
  {
    id: "urina-espuma",
    title: "Minha urina está fazendo muita espuma. É proteína?",
    body: [
      "Nem sempre. A urina pode espumar por vários motivos (força do jato, concentração, o próprio vaso).",
      "Mas espuma frequente, persistente ou diferente do habitual pode ser um sinal de perda de proteína — principalmente com inchaço, pressão alta, diabetes, sangue na urina ou histórico familiar.",
      "Não dá para saber se há proteína só olhando a urina. É preciso fazer exames.",
    ],
    tags: ["geral"],
  },
];

/** Escola do paciente — conteúdos curtos e compartilháveis. */
export const EDU_TOPICS: EduTopic[] = [
  {
    id: "o-que-e-drc",
    title: "O que é doença renal crônica (DRC)?",
    body: [
      "É quando existe uma alteração no rim que permanece por vários meses.",
      "Algumas pessoas têm redução da filtração; outras mantêm a filtração preservada, mas têm proteína, albumina ou sangue na urina.",
      "Por isso, a DRC não é definida apenas pela creatinina.",
    ],
    tags: ["drc", "geral"],
  },
  {
    id: "sem-sintomas",
    title: "Posso ter DRC e me sentir bem?",
    body: [
      "Sim. A doença renal crônica pode não causar sintomas durante muitos anos.",
      "É por isso que o acompanhamento com exames é tão importante.",
    ],
    tags: ["drc", "geral"],
  },
  {
    id: "creatinina",
    title: "O que é creatinina?",
    body: [
      "É uma substância do sangue que ajuda a calcular a função dos rins.",
      "Sozinha, a creatinina normal não exclui todas as doenças renais.",
    ],
    tags: ["geral"],
  },
  {
    id: "tfge",
    title: "O que é a taxa de filtração (TFGe)?",
    body: [
      "É uma estimativa de quanto os rins conseguem filtrar.",
      "O mais importante é acompanhar a evolução ao longo do tempo, e não um único resultado.",
    ],
    tags: ["geral", "drc"],
  },
  {
    id: "proteina-urina",
    title: "O que significa proteína/albumina na urina?",
    body: [
      "O rim funciona como um filtro e tenta manter as proteínas importantes dentro do sangue.",
      "Quando o filtro está machucado, parte dessas proteínas pode escapar para a urina.",
      "Albumina é um tipo de proteína. Exames como RAC, RPC e proteína de 24h ajudam a medir isso.",
    ],
    tags: ["diabetes", "glomerulopatia", "drc"],
  },
  {
    id: "sangue-urina",
    title: "Sangue na urina",
    body: [
      "Pode ter várias causas, incluindo pedras, infecções e inflamação dos filtros do rim.",
      "Sangue persistente na urina, junto com outras alterações, merece avaliação.",
    ],
    tags: ["glomerulopatia", "litiase"],
  },
  {
    id: "pressao-rim",
    title: "Pressão alta e rim",
    body: [
      "A pressão alta pode machucar lentamente os pequenos vasos dos rins.",
      "Ao mesmo tempo, um rim doente também pode dificultar o controle da pressão.",
    ],
    tags: ["hipertensao", "drc"],
  },
  {
    id: "diabetes-rim",
    title: "Diabetes e rim",
    body: [
      "O excesso de açúcar no sangue por muitos anos pode machucar os pequenos filtros dos rins.",
      "Uma das primeiras alterações pode ser o aparecimento de albumina na urina.",
    ],
    tags: ["diabetes", "drc"],
  },
  {
    id: "anti-inflamatorios",
    title: "Anti-inflamatórios e rim",
    body: [
      "O uso frequente de anti-inflamatórios pode, em algumas pessoas, prejudicar os rins.",
      "Converse com seu médico antes de usar esses remédios com frequência.",
    ],
    tags: ["geral"],
  },
  {
    id: "pedra",
    title: "Pedra nos rins",
    body: [
      "São cristais que se formam no sistema urinário. Existem vários tipos.",
      "Descobrir a causa ajuda a evitar novas crises — por isso a investigação e a hidratação são importantes.",
    ],
    tags: ["litiase"],
  },
  {
    id: "policistica",
    title: "Doença renal policística",
    body: [
      "É uma doença geralmente hereditária, em que vários cistos se desenvolvem nos rins ao longo da vida.",
    ],
    tags: ["geral"],
  },
  {
    id: "ira",
    title: "Lesão renal aguda",
    body: [
      "É uma piora da função renal que acontece em pouco tempo.",
      "Pode ocorrer por desidratação, infecções graves, medicamentos ou obstrução urinária, entre outras causas.",
    ],
    tags: ["geral"],
  },
  {
    id: "sindrome-nefrotica",
    title: "Síndrome nefrótica",
    body: [
      "É quando uma grande quantidade de proteína escapa pela urina.",
      "Pode causar inchaço, urina espumosa e queda da albumina no sangue.",
    ],
    tags: ["glomerulopatia"],
  },
  {
    id: "biopsia",
    title: "Por que meu médico pediu uma biópsia do rim?",
    body: [
      "Na biópsia, um pequeno fragmento do rim é retirado com uma agulha (geralmente guiada por ultrassom) e analisado no microscópio.",
      "Exames de sangue e urina mostram que algo está acontecendo, mas nem sempre dizem exatamente qual doença é.",
      "A biópsia pode ajudar a identificar o tipo de lesão e, em alguns casos, orientar o melhor tratamento.",
      "Nem toda pessoa com doença renal precisa fazer biópsia.",
    ],
    tags: ["glomerulopatia", "transplante"],
  },
  {
    id: "tratamentos",
    title: "Hemodiálise, diálise peritoneal e transplante",
    body: [
      "Quando a função renal fica muito reduzida, existem tratamentos que substituem parte do trabalho dos rins.",
      "As opções e o momento de cada uma são decididos junto com a equipe que acompanha você.",
    ],
    tags: ["drc", "transplante"],
  },
];

/** Os principais números do rim, explicados. */
export const FIVE_NUMBERS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Creatinina", body: "Ajuda a calcular a função renal." },
  { n: "2", title: "Taxa de filtração (TFGe)", body: "Estima quanto os rins conseguem filtrar." },
  { n: "3", title: "Proteína/albumina na urina", body: "Mostra se o filtro está deixando proteína escapar." },
  { n: "4", title: "Pressão arterial", body: "Pode machucar os rins e também surgir por causa de doença renal." },
  { n: "5", title: "Potássio", body: "Pode se alterar em algumas fases da doença renal ou por medicamentos." },
  { n: "6", title: "Bicarbonato", body: "Pode cair em fases mais avançadas da doença renal." },
  { n: "7", title: "Hemoglobina", body: "Algumas pessoas com doença renal podem desenvolver anemia." },
];

/** Fluxo educativo "Meus rins estão normais?". */
export const NORMAL_FLOW: { q: string; a: string }[] = [
  { q: "Seu ultrassom está normal?", a: "Ótimo — mas isso mostra principalmente a estrutura dos rins." },
  { q: "Sua creatinina e sua TFGe estão normais?", a: "Ótimo — mas ainda precisamos considerar sinais de lesão renal." },
  { q: "Existe albumina, proteína ou sangue na urina?", a: "Esses sinais podem indicar lesão mesmo com filtração preservada." },
  { q: "Existem fatores de risco (diabetes, hipertensão, história familiar, autoimunes, pedras, lesão prévia)?", a: "Eles ajudam a decidir a frequência de avaliação." },
];

export const RISK_FACTORS: string[] = [
  "Diabetes",
  "Hipertensão",
  "Doença cardiovascular",
  "Familiares com doença renal",
  "Idade avançada",
  "Obesidade",
  "Episódios anteriores de lesão renal aguda",
  "Pedras nos rins recorrentes",
  "Doenças autoimunes",
  "Alterações persistentes na urina",
  "Uso frequente de medicamentos que podem prejudicar os rins",
];

export const NEPHRO_WHEN: string[] = [
  "Creatinina alterada",
  "Redução persistente da TFGe",
  "Proteína/albumina na urina",
  "Sangue persistente na urina",
  "Pressão difícil de controlar",
  "Pedras recorrentes",
  "Alterações estruturais dos rins",
  "Doença renal hereditária",
  "Alterações importantes de potássio",
  "Perda rápida da função renal",
];

export const EDU_QUOTES: string[] = [
  "Doença renal crônica pode não causar sintomas durante muitos anos.",
  "Creatinina normal isoladamente não exclui todas as doenças renais.",
  "Taxa de filtração normal não exclui albuminúria ou outras formas de lesão renal.",
  "Sumário de urina normal não exclui pequenas quantidades de albumina na urina.",
  "Ultrassom normal não exclui doença renal crônica.",
  "A aparência do rim e o funcionamento do rim são coisas diferentes.",
  "Nenhum exame isolado conta toda a história do rim.",
];

/** Explicação leiga da TFGe para exibir na área do paciente. */
export function tfgeLayText(tfge: number): string {
  const pct = Math.round(tfge);
  return (
    `Essa taxa é uma estimativa de quanto os seus rins conseguem filtrar. ` +
    `Para facilitar, podemos pensar que a capacidade está aproximadamente na faixa de ${pct}% do esperado. ` +
    `Isso não significa que exatamente ${pct}% do rim esteja funcionando. O mais importante é acompanhar a evolução ao longo do tempo.`
  );
}
