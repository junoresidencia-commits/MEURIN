/* Mapa dos DOCUMENTOS OFICIAIS da SESAB dentro do pacote único (sem redesenho).
   O app extrai as PÁGINAS EXATAS do arquivo oficial para download/impressão.
   Índices 0-based dentro de public/forms/ceaf-sesab-nefrologia.pdf (17 páginas). */

export const CEAF_PACOTE = {
  file: "ceaf-sesab-nefrologia.pdf",
  source: "SESAB/BA",
  obtainedAt: "2026-08-11",
  version: 1,
  pageCount: 17,
};

export interface OfficialDocRef {
  label: string;
  pages: number[]; // 0-based
}

/** Por protocolo: TER e formulário oficiais (páginas exatas do pacote). */
export const CEAF_OFFICIAL_DOCS: Record<string, { ter?: OfficialDocRef; form?: OfficialDocRef }> = {
  anemia_drc_alfaepoetina: {
    ter: { label: "TER oficial — Alfaepoetina", pages: [2] },
    form: { label: "Formulário médico oficial — Anemia na DRC", pages: [3] },
  },
  anemia_drc_ferro: {
    ter: { label: "TER oficial — Sacarato de hidróxido férrico", pages: [4] },
    form: { label: "Formulário médico oficial — Anemia na DRC", pages: [3] },
  },
  dmo_drc: {
    ter: { label: "TER oficial — DMO-DRC", pages: [6] },
    form: { label: "Formulário de acesso oficial — DMO-DRC", pages: [7, 8] },
  },
  sindrome_nefrotica_pediatrica: {
    ter: { label: "TER oficial — Síndrome Nefrótica Primária (crianças e adolescentes)", pages: [9] },
    form: { label: "Formulário de acesso oficial — Síndrome Nefrótica Primária", pages: [10] },
  },
  les: {
    ter: { label: "TER oficial — LES", pages: [11, 12] },
    form: { label: "Formulário de acesso oficial — LES", pages: [13, 14, 15] },
  },
};

/** Documento complementar comum (comprovante em nome de terceiro). */
export const CEAF_RESIDENCIA_DOC: OfficialDocRef = { label: "Declaração de residência de terceiro — CEAF", pages: [16] };

export function officialDocPages(protocolId: string, doc: "ter" | "form" | "residencia"): OfficialDocRef | undefined {
  if (doc === "residencia") return CEAF_RESIDENCIA_DOC;
  return CEAF_OFFICIAL_DOCS[protocolId]?.[doc];
}

/** Campos de identificação sobrepostos no PDF oficial (origem inferior-esquerda, pontos).
 *  Critérios clínicos / checkboxes do PCDT NÃO entram aqui — o médico marca à mão. */
export type OverlayFieldName =
  | "introName" | "introDoctor"
  | "name" | "doctor" | "crm" | "uf" | "date"
  | "cpf" | "cns" | "age" | "city" | "local" | "service";
export type OverlayField = {
  field: OverlayFieldName;
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
};

export const OFFICIAL_OVERLAY: Record<string, { ter?: OverlayField[]; form?: OverlayField[] }> = {
  // TER DMO (pág. 7 do pacote): preenchimento no esclarecimento + rodapé.
  // Formulário DMO (págs. 8–9): só o cabeçalho; critérios (incl. calcitriol) ficam em branco.
  dmo_drc: {
    ter: [
      { field: "introName", page: 0, x: 84, y: 655.5, size: 9, maxWidth: 230 },
      { field: "introDoctor", page: 0, x: 158, y: 614.1, size: 9, maxWidth: 225 },
      { field: "local", page: 0, x: 83, y: 189.9, size: 9, maxWidth: 370 },
      { field: "date", page: 0, x: 488, y: 189.9, size: 9, maxWidth: 46 },
      { field: "name", page: 0, x: 137, y: 178.6, size: 9, maxWidth: 390 },
      { field: "cns", page: 0, x: 168, y: 164.8, size: 9, maxWidth: 155 },
      { field: "cpf", page: 0, x: 403, y: 164.8, size: 9, maxWidth: 125 },
      { field: "doctor", page: 0, x: 148, y: 99.4, size: 9, maxWidth: 140 },
      { field: "crm", page: 0, x: 322, y: 99.4, size: 9, maxWidth: 100 },
      { field: "uf", page: 0, x: 448, y: 99.4, size: 9, maxWidth: 80 },
    ],
    form: [
      { field: "date", page: 0, x: 483, y: 658.8, size: 9, maxWidth: 70 },
      { field: "name", page: 0, x: 152, y: 641.7, size: 10, maxWidth: 300 },
      { field: "age", page: 0, x: 494, y: 641.7, size: 10, maxWidth: 28 },
      { field: "service", page: 0, x: 102, y: 616.0, size: 10, maxWidth: 245 },
      { field: "city", page: 0, x: 396, y: 616.0, size: 10, maxWidth: 118 },
      { field: "doctor", page: 0, x: 164, y: 590.4, size: 10, maxWidth: 225 },
      { field: "crm", page: 0, x: 424, y: 590.4, size: 10, maxWidth: 68 },
      { field: "uf", page: 0, x: 515, y: 590.4, size: 10, maxWidth: 22 },
    ],
  },
  anemia_drc_alfaepoetina: {
    ter: [
      { field: "name", page: 0, x: 160, y: 200, size: 9, maxWidth: 250 },
      { field: "date", page: 0, x: 470, y: 200, size: 9, maxWidth: 70 },
      { field: "doctor", page: 0, x: 170, y: 133, size: 9, maxWidth: 210 },
      { field: "crm", page: 0, x: 422, y: 133, size: 9, maxWidth: 90 },
    ],
  },
  anemia_drc_ferro: {
    ter: [
      { field: "name", page: 0, x: 150, y: 224, size: 8, maxWidth: 260 },
      { field: "date", page: 0, x: 486, y: 224, size: 8, maxWidth: 70 },
      { field: "doctor", page: 0, x: 168, y: 155, size: 9, maxWidth: 210 },
      { field: "crm", page: 0, x: 420, y: 155, size: 9, maxWidth: 90 },
    ],
  },
};

/** Compat: overlays antigos só do TER. */
export type TerField = OverlayField;
export const TER_OVERLAY: Record<string, OverlayField[]> = Object.fromEntries(
  Object.entries(OFFICIAL_OVERLAY).map(([k, v]) => [k, v.ter || []])
);

/** Marca "X" nos medicamentos do TRE (DMO). Calcitriol NÃO é marcado automaticamente. */
export type MedMarkKey = "calcitriol" | "paricalcitol" | "cinacalcete" | "desferroxamina" | "sevelamer";
export const TER_MED_MARKS: Record<string, Partial<Record<MedMarkKey, { page: number; x: number; y: number; size?: number }>>> = {
  dmo_drc: {
    calcitriol: { page: 0, x: 69, y: 200.9, size: 10 },
    paricalcitol: { page: 0, x: 128, y: 200.9, size: 10 },
    cinacalcete: { page: 0, x: 198, y: 200.9, size: 10 },
    desferroxamina: { page: 0, x: 270, y: 200.9, size: 10 },
    sevelamer: { page: 0, x: 362, y: 200.9, size: 10 },
  },
};
/** O médico preenche o calcitriol (critérios no formulário / caixa no TRE). */
export const TER_MED_SKIP_AUTO: MedMarkKey[] = ["calcitriol"];

function normMed(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Quais caixas do TRE correspondem aos medicamentos da LME. */
export function terMedKeysFromNames(names: string[]): MedMarkKey[] {
  const keys = new Set<MedMarkKey>();
  for (const raw of names) {
    const n = normMed(raw || "");
    if (n.includes("calcitriol")) keys.add("calcitriol");
    else if (n.includes("paricalcitol")) keys.add("paricalcitol");
    else if (n.includes("cinacalcet")) keys.add("cinacalcete");
    else if (n.includes("desferroxamina") || n.includes("deferoxamina")) keys.add("desferroxamina");
    else if (n.includes("sevelamer")) keys.add("sevelamer");
  }
  return [...keys];
}

/** Infere o protocolo CEAF pelos nomes dos medicamentos da LME. */
export function inferProtocolFromMedNames(names: string[]): string | undefined {
  const blob = names.map(normMed).join(" ");
  if (/sevelamer|cinacalcet|paricalcitol|calcitriol|desferroxamina|deferoxamina/.test(blob)) return "dmo_drc";
  if (/alfaepoetina|epoetina|darbepoetina/.test(blob)) return "anemia_drc_alfaepoetina";
  if (/sacarato|hidroxido ferrico|ferro/.test(blob) && /anemia|ferric/.test(blob)) return "anemia_drc_ferro";
  if (/micofenolato|azatioprina/.test(blob)) return "les";
  if (/tacrolimo/.test(blob)) return "sindrome_nefrotica_pediatrica";
  if (/ciclofosfamida|ciclosporina/.test(blob)) return "sindrome_nefrotica_adultos";
  return undefined;
}
