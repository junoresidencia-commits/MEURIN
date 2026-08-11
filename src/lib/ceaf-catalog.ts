/* ============================================================================
   CATÁLOGO OFICIAL CEAF — NEFROLOGIA — SESAB/BA (fonte única da verdade)
   ----------------------------------------------------------------------------
   Este catálogo codifica EXATAMENTE os dados oficiais informados/conferidos nas
   páginas atuais da SESAB. NÃO inventar CID, medicamento, apresentação ou exame.
   Qualquer combinação não listada aqui NÃO deve ser gerada automaticamente.

   Ao atualizar uma regra oficial, altere aqui e atualize `lastReview` + `version`.
   Client-safe (sem imports de servidor) — usado pelo wizard e pelas APIs.
   ============================================================================ */

export type CeafPhase = "abertura" | "renovacao" | "monitoramento";

export interface CeafCid {
  code: string;
  description: string;
}

export interface CeafExamRule {
  label: string;
  /** Chave do exame no prontuário (labs) p/ conferência automática de validade. Ausente = anexar/conferir manual. */
  testKey?: string;
  validityDays: number;
  phase: CeafPhase;
  required: boolean;
  note?: string;
}

export interface CeafMedication {
  id: string;
  /** Denominação oficial (DCB) + concentração. */
  name: string;
  presentation: string;
  /** Exames específicos deste medicamento (somados aos exames-base do protocolo). */
  exams?: CeafExamRule[];
  note?: string;
}

export interface CeafProtocol {
  id: string;
  group: "nefrologia";
  name: string;
  source: string; // ex.: "SESAB/BA"
  lastReview: string; // ISO date da última conferência
  version: number;
  cids: CeafCid[];
  medications: CeafMedication[];
  /** Exames comuns a todos os medicamentos do protocolo (abertura, salvo indicação). */
  baseExams: CeafExamRule[];
  documents: string[];
  /** TER e formulário de acesso são OFICIAIS — o app só preenche o arquivo oficial. */
  requiresTer: boolean;
  requiresAccessForm: boolean;
  renewalMonths?: number;
  notes?: string;
}

const LAST_REVIEW = "2026-08-11";

// Exames reutilizados
const E = {
  hemograma: (): CeafExamRule => ({ label: "Hemograma", testKey: "hemoglobina", validityDays: 90, phase: "abertura", required: true }),
  ferritina: (): CeafExamRule => ({ label: "Ferritina sérica", testKey: "ferritina", validityDays: 90, phase: "abertura", required: true }),
  ist: (): CeafExamRule => ({ label: "Saturação de transferrina (IST)", testKey: "sat_transferrina", validityDays: 90, phase: "abertura", required: true }),
  tfg: (): CeafExamRule => ({ label: "TFG (clearance ou calculada pela creatinina)", testKey: "tfge", validityDays: 180, phase: "abertura", required: true }),
  pth: (): CeafExamRule => ({ label: "PTH sérico", testKey: "pth", validityDays: 90, phase: "abertura", required: true }),
  calcio: (): CeafExamRule => ({ label: "Cálcio sérico", testKey: "calcio", validityDays: 90, phase: "abertura", required: true }),
  calcioCorrigido: (): CeafExamRule => ({ label: "Cálcio total corrigido pela albumina", testKey: "calcio", validityDays: 90, phase: "abertura", required: true, note: "Corrigir pela albumina" }),
  fosforo: (): CeafExamRule => ({ label: "Fósforo sérico", testKey: "fosforo", validityDays: 90, phase: "abertura", required: true }),
  vitD: (): CeafExamRule => ({ label: "25-hidróxi-vitamina D", testKey: "vitamina_d", validityDays: 90, phase: "abertura", required: true, note: "Para calcitriol em paciente que NÃO esteja em TRS" }),
  creatinina: (): CeafExamRule => ({ label: "Creatinina sérica", testKey: "creatinina", validityDays: 90, phase: "abertura", required: true }),
  albumina: (): CeafExamRule => ({ label: "Albumina sérica", testKey: "albumina", validityDays: 90, phase: "abertura", required: true }),
  proteinuria: (): CeafExamRule => ({ label: "Proteinúria de 24h ou amostra isolada (RPC)", testKey: "proteinuria_24h", validityDays: 90, phase: "abertura", required: true }),
  anexo: (label: string): CeafExamRule => ({ label, validityDays: 0, phase: "abertura", required: true, note: "Anexar (sem conferência automática)" }),
};

export const CEAF_PROTOCOLS: CeafProtocol[] = [
  // 1) ANEMIA NA DRC — ALFAEPOETINA
  {
    id: "anemia_drc_alfaepoetina",
    group: "nefrologia",
    name: "Anemia na DRC — Alfaepoetina",
    source: "SESAB/BA",
    lastReview: LAST_REVIEW,
    version: 1,
    cids: [
      { code: "N18.0", description: "Doença renal em estádio final" },
      { code: "N18.8", description: "Outra insuficiência renal crônica" },
    ],
    medications: [
      { id: "alfaepoetina_2000", name: "Alfaepoetina 2.000 UI injetável", presentation: "frasco-ampola" },
      { id: "alfaepoetina_4000", name: "Alfaepoetina 4.000 UI injetável", presentation: "frasco-ampola" },
      { id: "alfaepoetina_10000", name: "Alfaepoetina 10.000 UI injetável", presentation: "frasco-ampola" },
    ],
    baseExams: [E.hemograma(), E.ferritina(), E.ist(), E.tfg()],
    documents: ["Documento de identidade", "CPF", "Comprovante de residência", "LME oficial", "Prescrição", "TER oficial", "Formulário oficial de acesso (SESAB) OU relatório médico com as informações exigidas"],
    requiresTer: true,
    requiresAccessForm: true,
    renewalMonths: 6,
    notes: "LME e receita renovados semestralmente, salvo mudança de dose (novo documento). Monitoramento: hemoglobina mensal; ferritina e IST antes de ajuste de dose.",
  },
  // 2) ANEMIA NA DRC — REPOSIÇÃO DE FERRO (IV)
  {
    id: "anemia_drc_ferro",
    group: "nefrologia",
    name: "Anemia na DRC — Reposição de ferro (endovenoso)",
    source: "SESAB/BA",
    lastReview: LAST_REVIEW,
    version: 1,
    cids: [
      { code: "N18.0", description: "Doença renal em estádio final" },
      { code: "N18.8", description: "Outra insuficiência renal crônica" },
    ],
    medications: [
      { id: "sacarato_ferrico_100", name: "Sacarato de hidróxido férrico 100 mg injetável", presentation: "frasco de 5 mL" },
    ],
    baseExams: [E.ferritina(), E.hemograma(), E.ist(), E.tfg()],
    documents: ["Documento de identidade", "CPF", "CNS do paciente", "Comprovante de residência", "LME oficial", "Receita", "TER oficial", "Formulário de acesso OU relatório médico correspondente"],
    requiresTer: true,
    requiresAccessForm: true,
    notes: "NÃO cadastrar sulfato ferroso oral como medicamento CEAF deste protocolo. Monitoramento: hemoglobina mensal; ferritina + IST trimestral.",
  },
  // 3) DISTÚRBIO MINERAL ÓSSEO NA DRC (DMO-DRC)
  {
    id: "dmo_drc",
    group: "nefrologia",
    name: "Distúrbio Mineral Ósseo na DRC (DMO-DRC)",
    source: "SESAB/BA",
    lastReview: LAST_REVIEW,
    version: 1,
    cids: [
      { code: "N18.2", description: "DRC estágio 2" },
      { code: "N18.3", description: "DRC estágio 3" },
      { code: "N18.4", description: "DRC estágio 4" },
      { code: "N18.5", description: "DRC estágio 5" },
      { code: "N25.0", description: "Osteodistrofia renal" },
    ],
    medications: [
      { id: "sevelamer_800", name: "Sevelâmer 800 mg", presentation: "comprimido", exams: [E.fosforo(), E.calcioCorrigido(), E.pth(), E.creatinina()] },
      { id: "calcitriol_025", name: "Calcitriol 0,25 mcg", presentation: "cápsula", exams: [E.pth(), E.calcio(), E.fosforo(), E.vitD()] },
      { id: "cinacalcete_30", name: "Cinacalcete 30 mg", presentation: "comprimido", exams: [E.pth(), E.calcio(), E.fosforo()] },
      { id: "cinacalcete_60", name: "Cinacalcete 60 mg", presentation: "comprimido", exams: [E.pth(), E.calcio(), E.fosforo()] },
      { id: "paricalcitol_5", name: "Paricalcitol 5 mcg/mL injetável", presentation: "ampola", exams: [E.pth(), E.calcio(), E.fosforo()] },
      { id: "desferroxamina_500", name: "Desferroxamina 500 mg injetável", presentation: "frasco-ampola", note: "Checklist específico oficial — conferir o formulário/TER da SESAB para desferroxamina." },
    ],
    baseExams: [],
    documents: ["Documentos pessoais", "Comprovante de residência", "LME", "Receita", "TER oficial da DMO", "Formulário oficial de solicitação dos medicamentos de DMO OU relatório adequado"],
    requiresTer: true,
    requiresAccessForm: true,
    notes: "Cada medicamento tem exames próprios (não são os mesmos para todos). Desferroxamina usa checklist específico oficial.",
  },
  // 4) SÍNDROME NEFRÓTICA PRIMÁRIA EM CRIANÇAS E ADOLESCENTES
  {
    id: "sindrome_nefrotica_pediatrica",
    group: "nefrologia",
    name: "Síndrome Nefrótica Primária em Crianças e Adolescentes",
    source: "SESAB/BA",
    lastReview: LAST_REVIEW,
    version: 1,
    cids: [
      { code: "N04.0", description: "Síndrome nefrótica — anormalidade glomerular minor" },
      { code: "N04.1", description: "Síndrome nefrótica — lesões glomerulares focais e segmentares" },
      { code: "N04.2", description: "Síndrome nefrótica — glomerulonefrite membranosa difusa" },
      { code: "N04.3", description: "Síndrome nefrótica — glomerulonefrite proliferativa mesangial difusa" },
      { code: "N04.4", description: "Síndrome nefrótica — glomerulonefrite proliferativa endocapilar difusa" },
      { code: "N04.5", description: "Síndrome nefrótica — glomerulonefrite mesangiocapilar difusa" },
      { code: "N04.6", description: "Síndrome nefrótica — doença de depósito denso" },
      { code: "N04.7", description: "Síndrome nefrótica — glomerulonefrite difusa em crescente" },
      { code: "N04.8", description: "Síndrome nefrótica — outras" },
    ],
    medications: [
      { id: "tacrolimo_1", name: "Tacrolimo 1 mg", presentation: "cápsula" },
      { id: "tacrolimo_5", name: "Tacrolimo 5 mg", presentation: "cápsula" },
      { id: "ciclofosfamida_50", name: "Ciclofosfamida 50 mg", presentation: "drágea", note: "Abrir checklist complementar oficial da ciclofosfamida." },
      { id: "ciclosporina_25", name: "Ciclosporina 25 mg", presentation: "cápsula" },
      { id: "ciclosporina_50", name: "Ciclosporina 50 mg", presentation: "cápsula" },
      { id: "ciclosporina_100", name: "Ciclosporina 100 mg", presentation: "cápsula" },
      { id: "ciclosporina_sol", name: "Ciclosporina solução oral 100 mg/mL", presentation: "frasco" },
    ],
    baseExams: [
      E.proteinuria(), E.albumina(),
      { label: "Colesterol total", testKey: "colesterol_total", validityDays: 90, phase: "abertura", required: true },
      { label: "HDL", testKey: "hdl", validityDays: 90, phase: "abertura", required: true },
      { label: "LDL", testKey: "ldl", validityDays: 90, phase: "abertura", required: true },
      { label: "Triglicerídeos", testKey: "triglicerideos", validityDays: 90, phase: "abertura", required: true },
      E.creatinina(), E.hemograma(),
      { label: "Glicemia de jejum", testKey: "glicemia_jejum", validityDays: 90, phase: "abertura", required: true },
      E.anexo("Anti-HCV"), E.anexo("Anti-HIV"), E.anexo("HBsAg"), E.anexo("FAN"), E.anexo("Laudo de biópsia renal"),
    ],
    documents: ["LME oficial", "Receita", "TER oficial", "Formulário oficial de Síndrome Nefrótica Primária em Crianças e Adolescentes OU relatório adequado"],
    requiresTer: true,
    requiresAccessForm: true,
    notes: "Micofenolato NÃO faz parte deste protocolo (não consta na relação atual da SESAB para SN primária pediátrica).",
  },
  // 5) LÚPUS ERITEMATOSO SISTÊMICO / NEFRITE LÚPICA (quando aplicável)
  {
    id: "les",
    group: "nefrologia",
    name: "Lúpus Eritematoso Sistêmico (LES) / nefrite lúpica quando aplicável",
    source: "SESAB/BA",
    lastReview: LAST_REVIEW,
    version: 1,
    cids: [
      { code: "L93.0", description: "Lúpus eritematoso discoide" },
      { code: "L93.1", description: "Lúpus eritematoso cutâneo subagudo" },
      { code: "M32.1", description: "LES com comprometimento de outros órgãos e sistemas" },
      { code: "M32.8", description: "Outras formas de LES" },
    ],
    medications: [
      { id: "micofenolato_500", name: "Micofenolato de mofetila 500 mg", presentation: "comprimido", exams: [E.creatinina(), E.proteinuria()] },
      { id: "azatioprina_50", name: "Azatioprina 50 mg", presentation: "comprimido" },
      { id: "ciclofosfamida_50_les", name: "Ciclofosfamida 50 mg", presentation: "drágea" },
      { id: "ciclosporina_25_les", name: "Ciclosporina 25 mg", presentation: "cápsula", exams: [E.creatinina(), E.proteinuria()] },
      { id: "ciclosporina_50_les", name: "Ciclosporina 50 mg", presentation: "cápsula", exams: [E.creatinina(), E.proteinuria()] },
      { id: "ciclosporina_100_les", name: "Ciclosporina 100 mg", presentation: "cápsula", exams: [E.creatinina(), E.proteinuria()] },
      { id: "ciclosporina_sol_les", name: "Ciclosporina solução oral 100 mg/mL", presentation: "frasco", exams: [E.creatinina(), E.proteinuria()] },
    ],
    baseExams: [
      E.anexo("FAN"), E.hemograma(), E.anexo("Sumário de urina (EAS)"), E.anexo("Beta-HCG (quando aplicável)"),
    ],
    documents: ["LME oficial", "Receita", "TER oficial do LES", "Formulário oficial do LES OU relatório adequado"],
    requiresTer: true,
    requiresAccessForm: true,
    notes: "Micofenolato pertence ao protocolo de LES (não à SN primária pediátrica). Exames adicionais conforme o medicamento e o protocolo oficial.",
  },
];

export function getProtocol(id: string): CeafProtocol | undefined {
  return CEAF_PROTOCOLS.find((p) => p.id === id);
}

export function getMedication(protocolId: string, medId: string): CeafMedication | undefined {
  return getProtocol(protocolId)?.medications.find((m) => m.id === medId);
}

/** Exames efetivos = base do protocolo + exames dos medicamentos selecionados (dedup por label). */
export function effectiveExams(protocolId: string, medIds: string[]): CeafExamRule[] {
  const p = getProtocol(protocolId);
  if (!p) return [];
  const out: CeafExamRule[] = [...p.baseExams];
  for (const medId of medIds) {
    const m = p.medications.find((x) => x.id === medId);
    for (const e of m?.exams ?? []) {
      if (!out.some((o) => o.label === e.label)) out.push(e);
    }
  }
  return out;
}

export function cidAllowed(protocolId: string, code: string): boolean {
  const p = getProtocol(protocolId);
  return Boolean(p && p.cids.some((c) => c.code === code));
}
