/**
 * Biblioteca de modelos prontos (client-safe) para acelerar a consulta.
 * Cobre receitas, pedidos de exame, evoluções e relatórios em nefrologia.
 *
 * IMPORTANTE: são pontos de partida — o médico deve revisar e ajustar dose,
 * posologia e conduta conforme função renal e o caso de cada paciente.
 * Tudo é editável antes de imprimir/salvar. Use {{paciente}} para inserir
 * o nome do paciente automaticamente ao aplicar o modelo.
 */

export type TemplateType = "receita" | "exame" | "relatorio" | "evolucao";

export interface DocTemplate {
  id: string;
  type: TemplateType;
  title: string;
  body: string;
}

export const TEMPLATE_TYPE_LABEL: Record<TemplateType, string> = {
  receita: "Receita",
  exame: "Pedido de exames",
  relatorio: "Relatório",
  evolucao: "Evolução",
};

const R = (id: string, title: string, body: string): DocTemplate => ({ id, type: "receita", title, body });
const E = (id: string, title: string, body: string): DocTemplate => ({ id, type: "exame", title, body });
const V = (id: string, title: string, body: string): DocTemplate => ({ id, type: "evolucao", title, body });
const L = (id: string, title: string, body: string): DocTemplate => ({ id, type: "relatorio", title, body });

export const BUILTIN_TEMPLATES: DocTemplate[] = [
  // ------------------- RECEITAS -------------------
  R("rx_has", "Hipertensão arterial", [
    "Losartana 50 mg — 1 comprimido a cada 12 horas",
    "Anlodipino 5 mg — 1 comprimido ao dia",
    "Hidroclorotiazida 25 mg — 1 comprimido pela manhã",
    "Orientações: dieta hipossódica, monitorar pressão em casa.",
  ].join("\n")),
  R("rx_drc", "DRC (nefroproteção)", [
    "Losartana 50 mg — 1 comprimido ao dia (ajustar conforme PA e potássio)",
    "Dapagliflozina 10 mg — 1 comprimido ao dia",
    "Orientações: controle de PA, dieta hipossódica e evitar anti-inflamatórios.",
  ].join("\n")),
  R("rx_dm", "Diabetes", [
    "Metformina 850 mg — 1 comprimido a cada 12 horas (ajustar/suspender conforme TFGe)",
    "Dapagliflozina 10 mg — 1 comprimido ao dia",
    "Orientações: controle glicêmico, dieta e atividade física.",
  ].join("\n")),
  R("rx_itu", "ITU (cistite)", [
    "Nitrofurantoína 100 mg — 1 comprimido a cada 6 horas por 5 dias (evitar se TFGe baixa)",
    "Aumentar ingesta hídrica.",
  ].join("\n")),
  R("rx_pielo", "Pielonefrite", [
    "Ciprofloxacino 500 mg — 1 comprimido a cada 12 horas por 7 a 14 dias (ajustar à função renal)",
    "Sintomáticos: analgésico/antitérmico se necessário.",
    "Retornar/urgência se febre alta persistente ou vômitos.",
  ].join("\n")),
  R("rx_nefrotica", "Síndrome nefrótica", [
    "Furosemida 40 mg — 1 a 2 comprimidos ao dia conforme edema",
    "Enalapril 10 mg — 1 comprimido ao dia (nefroproteção/proteinúria)",
    "Considerar estatina e profilaxia conforme avaliação.",
    "Dieta hipossódica; controle de peso diário.",
  ].join("\n")),
  R("rx_hiperk", "Hipercalemia", [
    "Suspender/ajustar IECA/BRA e poupadores de potássio.",
    "Poliestirenossulfonato de cálcio (Sorcal) — conforme prescrição",
    "Dieta pobre em potássio; reavaliar potássio em 24–48h.",
  ].join("\n")),
  R("rx_hipok", "Hipocalemia", [
    "Cloreto de potássio (xarope 6% ou comprimido) — repor conforme nível sérico",
    "Investigar/tratar causa (diuréticos, perdas GI).",
    "Reavaliar potássio após reposição.",
  ].join("\n")),
  R("rx_acidose", "Acidose metabólica", [
    "Bicarbonato de sódio 500 mg — 1 comprimido a cada 8–12 horas (alvo HCO3 ≥ 22)",
    "Reavaliar bicarbonato e potássio.",
  ].join("\n")),
  R("rx_hiperfosf", "Hiperfosfatemia", [
    "Carbonato de cálcio 500 mg — 1 a 2 comprimidos às refeições (quelante de fósforo)",
    "Dieta com restrição de fósforo.",
    "Reavaliar cálcio, fósforo e PTH.",
  ].join("\n")),
  R("rx_anemia_drc", "Anemia da DRC", [
    "Alfaepoetina — conforme peso e alvo de hemoglobina (via subcutânea)",
    "Sacarato de hidróxido férrico / ferro oral — repor conforme ferritina e sat. de transferrina",
    "Reavaliar hemograma, ferritina e IST.",
  ].join("\n")),
  R("rx_tx", "Pós-transplante renal", [
    "Tacrolimo — conforme nível sérico alvo",
    "Micofenolato — conforme prescrição",
    "Prednisona — conforme esquema",
    "Profilaxias conforme protocolo (não suspender por conta própria).",
  ].join("\n")),

  // ------------------- PEDIDOS DE EXAME -------------------
  E("ex_1a", "Primeira consulta nefrológica", [
    "Ureia, creatinina, TFGe",
    "Sódio, potássio, cálcio, fósforo, magnésio",
    "Hemograma completo",
    "Glicemia de jejum, HbA1c",
    "Urina tipo 1 (EAS)",
    "Relação albumina/creatinina (RAC)",
    "Ultrassonografia de rins e vias urinárias",
  ].join("\n")),
  E("ex_drc3", "DRC estágio 3", [
    "Ureia, creatinina, TFGe",
    "Sódio, potássio, cálcio, fósforo",
    "PTH, 25-OH vitamina D",
    "Hemograma, ferritina, sat. de transferrina",
    "Relação albumina/creatinina (RAC)",
  ].join("\n")),
  E("ex_drc4", "DRC estágio 4", [
    "Ureia, creatinina, TFGe",
    "Sódio, potássio, cálcio, fósforo, magnésio, bicarbonato",
    "PTH, 25-OH vitamina D",
    "Hemograma, ferritina, sat. de transferrina",
    "Relação albumina/creatinina (RAC)",
    "Gasometria venosa",
  ].join("\n")),
  E("ex_drc5", "DRC estágio 5 (pré-diálise)", [
    "Ureia, creatinina, TFGe",
    "Sódio, potássio, cálcio, fósforo, magnésio, bicarbonato",
    "PTH, 25-OH vitamina D",
    "Hemograma, ferritina, sat. de transferrina",
    "Sorologias: HBsAg, anti-HBs, anti-HCV, HIV",
    "Gasometria venosa",
  ].join("\n")),
  E("ex_proteinuria", "Proteinúria", [
    "Relação proteína/creatinina (RPC)",
    "Relação albumina/creatinina (RAC)",
    "Proteinúria de 24 horas",
    "Albumina sérica, perfil lipídico",
    "Urina tipo 1 (EAS)",
  ].join("\n")),
  E("ex_hematuria", "Hematúria", [
    "Urina tipo 1 (EAS) com dismorfismo eritrocitário",
    "Relação proteína/creatinina (RPC)",
    "Ureia, creatinina, TFGe",
    "Ultrassonografia de rins e vias urinárias",
  ].join("\n")),
  E("ex_ha_resistente", "Hipertensão resistente", [
    "Sódio, potássio",
    "Relação aldosterona/renina",
    "TSH",
    "Cortisol, metanefrinas (se suspeita)",
    "Urina tipo 1 (EAS), RAC",
    "Ultrassonografia com Doppler de artérias renais",
  ].join("\n")),
  E("ex_litiase", "Litíase renal", [
    "Cálcio, ácido úrico, fósforo",
    "PTH",
    "Urina tipo 1 (EAS)",
    "Cálcio, oxalato, citrato e ácido úrico urinários de 24h",
    "Tomografia de abdome sem contraste (ou USG)",
  ].join("\n")),
  E("ex_ira", "IRA (injúria renal aguda)", [
    "Ureia, creatinina (seriadas), TFGe",
    "Sódio, potássio, cálcio, fósforo, bicarbonato",
    "Hemograma",
    "Urina tipo 1 (EAS), sódio urinário, FeNa",
    "Ultrassonografia de rins e vias urinárias",
  ].join("\n")),
  E("ex_glomerulo", "Glomerulopatias", [
    "Complemento (C3, C4)",
    "FAN, anti-DNA",
    "ANCA, anti-MBG",
    "Sorologias HBV, HCV, HIV",
    "Eletroforese de proteínas séricas e urinárias",
    "Proteinúria de 24h, RPC, albumina sérica",
  ].join("\n")),
  E("ex_tx", "Pós-transplante renal", [
    "Ureia, creatinina, TFGe",
    "Nível sérico de tacrolimo",
    "Hemograma, glicemia",
    "Urina tipo 1 (EAS), RAC",
  ].join("\n")),
  E("ex_pre_biopsia", "Pré-biópsia renal", [
    "Hemograma com plaquetas",
    "Coagulograma (TP/INR, TTPa)",
    "Tipagem sanguínea",
    "Ureia, creatinina",
    "Ultrassonografia renal",
  ].join("\n")),
  E("ex_checkup", "Check-up renal", [
    "Ureia, creatinina, TFGe",
    "Urina tipo 1 (EAS)",
    "Relação albumina/creatinina (RAC)",
    "Glicemia de jejum",
    "Ultrassonografia de rins e vias urinárias",
  ].join("\n")),

  // ------------------- EVOLUÇÕES -------------------
  V("ev_1a", "Primeira consulta", [
    "Paciente: {{paciente}}",
    "Queixa principal: ",
    "História da doença atual: ",
    "Antecedentes / comorbidades: ",
    "Medicamentos em uso: ",
    "Exame físico: PA __ x __ mmHg, edema (  ), ausculta __",
    "Hipóteses diagnósticas: ",
    "Conduta / plano: ",
  ].join("\n")),
  V("ev_retorno", "Retorno", [
    "Paciente: {{paciente}} — consulta de retorno.",
    "Evolução desde a última consulta: ",
    "Exames recentes: ",
    "Exame físico: PA __ x __ mmHg, edema (  )",
    "Conduta: manter/ajustar tratamento conforme abaixo.",
  ].join("\n")),
  V("ev_alta", "Alta", [
    "Paciente: {{paciente}} — alta do acompanhamento.",
    "Motivo da alta: ",
    "Orientações e sinais de alerta: ",
    "Encaminhamentos: ",
  ].join("\n")),
  V("ev_tele", "Teleconsulta", [
    "Paciente: {{paciente}} — atendimento por telemedicina, com consentimento.",
    "Queixa / evolução: ",
    "Conduta: ",
    "Orientado que, se necessário, será indicado atendimento presencial.",
  ].join("\n")),
  V("ev_inter", "Interconsulta", [
    "Paciente: {{paciente}} — avaliação nefrológica solicitada.",
    "Motivo da interconsulta: ",
    "Impressão nefrológica: ",
    "Sugestões / conduta: ",
  ].join("\n")),
  V("ev_predialise", "Pré-diálise", [
    "Paciente: {{paciente}} — acompanhamento pré-diálise.",
    "TFGe atual: ",
    "Sintomas urêmicos: ",
    "Preparo: confecção de acesso / orientação sobre modalidades.",
    "Conduta: ",
  ].join("\n")),
  V("ev_hd", "Hemodiálise", [
    "Paciente: {{paciente}} — em programa de hemodiálise.",
    "Acesso: ",
    "Intercorrências na sessão: ",
    "Peso seco / ganho interdialítico: ",
    "Conduta: ",
  ].join("\n")),
  V("ev_dp", "Diálise peritoneal", [
    "Paciente: {{paciente}} — em diálise peritoneal.",
    "Esquema de trocas: ",
    "Aspecto do efluente / sinais de peritonite: ",
    "Conduta: ",
  ].join("\n")),
  V("ev_tx", "Transplante renal", [
    "Paciente: {{paciente}} — pós-transplante renal.",
    "Tempo de transplante: ",
    "Função do enxerto (creatinina/TFGe): ",
    "Imunossupressão e níveis: ",
    "Conduta: ",
  ].join("\n")),

  // ------------------- RELATÓRIOS -------------------
  L("rel_medico", "Relatório médico", [
    "Atesto para os devidos fins que o(a) paciente {{paciente}} encontra-se sob meus cuidados,",
    "com diagnóstico de ____ (CID ____).",
    "Descrição do quadro clínico e conduta: ",
    "Este relatório é emitido a pedido do(a) paciente.",
  ].join("\n")),
  L("rel_encaminhamento", "Encaminhamento", [
    "Encaminho o(a) paciente {{paciente}} para avaliação de ____.",
    "Motivo do encaminhamento / resumo clínico: ",
    "Exames relevantes: ",
    "Agradeço a avaliação e retorno.",
  ].join("\n")),
  // Relatórios-base por doença (CEAF) — critérios comuns, edite antes de assinar.
  L("rel_anemia_drc", "Base — Anemia na DRC (CEAF)", [
    "RELATÓRIO MÉDICO",
    "Paciente: {{paciente}}",
    "Diagnóstico: Doença renal crônica, estágio ____ (CID N18.__), com anemia associada.",
    "",
    "Critérios (CEAF/SESAB):",
    "- Hemoglobina: ____ g/dL",
    "- Ferritina: ____ ng/mL (alvo conforme protocolo)",
    "- Saturação de transferrina (IST): ____ %",
    "",
    "Conduta: solicito ____ (alfaepoetina / sacarato de hidróxido férrico) conforme PCDT.",
    "Declaro que o(a) paciente preenche os critérios do protocolo.",
  ].join("\n")),
  L("rel_dmo_drc", "Base — DMO-DRC (CEAF)", [
    "RELATÓRIO MÉDICO",
    "Paciente: {{paciente}}",
    "Diagnóstico: Distúrbio mineral e ósseo da DRC (CID ____).",
    "",
    "Critérios/exames: PTH ____ pg/mL; Cálcio ____; Fósforo ____; Vitamina D ____.",
    "Conduta: solicito ____ conforme PCDT/SESAB.",
    "Declaro que o(a) paciente preenche os critérios do protocolo.",
  ].join("\n")),
  L("rel_sindrome_nefrotica", "Base — Síndrome nefrótica (CEAF)", [
    "RELATÓRIO MÉDICO",
    "Paciente: {{paciente}}",
    "Diagnóstico: Síndrome nefrótica (CID N04.__).",
    "",
    "Quadro: proteinúria ____ g/24h, albumina ____ g/dL, edema.",
    "Tratamento prévio: ____.",
    "Conduta: solicito ____ conforme PCDT.",
    "Declaro que o(a) paciente preenche os critérios do protocolo.",
  ].join("\n")),
];

export function builtinByType(type: TemplateType): DocTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.type === type);
}

/** Substitui variáveis simples ao aplicar o modelo. */
export function fillTemplate(body: string, vars: { paciente?: string }): string {
  return body
    .replace(/\{\{\s*paciente\s*\}\}/gi, vars.paciente?.trim() || "")
    .replace(/\{\{\s*data\s*\}\}/gi, new Date().toLocaleDateString("pt-BR"));
}
