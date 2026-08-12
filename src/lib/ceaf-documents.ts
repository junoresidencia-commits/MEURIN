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

/** Sobreposição de texto no TER oficial (PDF achatado): posições em pontos (origem inferior-esquerda),
 *  relativas à página de saída (0 = primeira página do TER). Campo: name/doctor/crm/date. */
export type TerField = { field: "name" | "doctor" | "crm" | "date"; page: number; x: number; y: number; size?: number };
export const TER_OVERLAY: Record<string, TerField[]> = {
  anemia_drc_alfaepoetina: [
    { field: "name", page: 0, x: 150, y: 201 },
    { field: "date", page: 0, x: 470, y: 201 },
    { field: "doctor", page: 0, x: 165, y: 121 },
    { field: "crm", page: 0, x: 395, y: 121 },
  ],
  anemia_drc_ferro: [
    { field: "name", page: 0, x: 150, y: 201 },
    { field: "date", page: 0, x: 470, y: 201 },
    { field: "doctor", page: 0, x: 165, y: 121 },
    { field: "crm", page: 0, x: 395, y: 121 },
  ],
};
