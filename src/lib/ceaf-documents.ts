/* Fonte única: protocolo CEAF → documentos oficiais no pacote SESAB.
   O app extrai as PÁGINAS EXATAS de public/forms/ceaf-sesab-nefrologia.pdf.
   Não redesenha LME/TER/formulário. Não inventa documento de outro protocolo. */

import { CEAF_PROTOCOLS } from "@/lib/ceaf-catalog";

export const CEAF_PACOTE = {
  file: "ceaf-sesab-nefrologia.pdf",
  source: "SESAB/BA",
  obtainedAt: "2026-08-11",
  version: 1,
  pageCount: 17,
} as const;

export const CEAF_LME_FILE = "lme-oficial.pdf";

export type OfficialDocKind = "ter" | "form" | "residencia";

export interface OfficialDocRef {
  label: string;
  pages: number[]; // 0-based no pacote
}

/** Campos de identificação sobrepostos no PDF oficial (origem inferior-esquerda, pontos).
 *  Critérios clínicos / checkboxes do PCDT NÃO entram aqui — o médico marca à mão. */
export type OverlayFieldName =
  | "introName"
  | "introDoctor"
  | "name"
  | "doctor"
  | "crm"
  | "uf"
  | "date"
  | "cpf"
  | "cns"
  | "age"
  | "city"
  | "local"
  | "service"
  | "birth";

export type OverlayField = {
  field: OverlayFieldName;
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
};

/** @deprecated use OverlayFieldName */
export type TerOverlayField = OverlayFieldName;
/** @deprecated use OverlayField */
export type TerField = OverlayField;

export type OfficialDocAvailable = OfficialDocRef & {
  status: "available";
  overlay?: OverlayField[];
};

export type OfficialDocUnavailable = {
  status: "unavailable";
  label: string;
  reason: string;
};

export type OfficialDocSlot = OfficialDocAvailable | OfficialDocUnavailable;

export type ProtocolOfficialPack = {
  protocolId: string;
  lme: OfficialDocAvailable;
  ter: OfficialDocSlot;
  form: OfficialDocSlot;
  residence: OfficialDocAvailable;
};

const LME_DOC: OfficialDocAvailable = {
  status: "available",
  label: "LME oficial SESAB/CEAF",
  pages: [],
};

const RESIDENCE_DOC: OfficialDocAvailable = {
  status: "available",
  label: "Declaração de residência de terceiro — CEAF",
  pages: [16],
};

const UNAVAILABLE_ADULT_SN =
  "O pacote oficial da SESAB no Meu Rim traz TER e formulário da Síndrome Nefrótica Primária em Crianças e Adolescentes. O de adultos não está neste arquivo — não usamos o documento pediátrico no lugar.";

type ProtocolDocMap = {
  ter?: OfficialDocAvailable;
  form?: OfficialDocAvailable;
};

/** Todos os IDs do catálogo entram aqui. Ausência de ter/form = não aplicável neste pacote. */
export const PROTOCOL_OFFICIAL_DOCS: Record<string, ProtocolDocMap> = {
  anemia_drc_alfaepoetina: {
    ter: {
      status: "available",
      label: "TER oficial — Alfaepoetina",
      pages: [2],
      overlay: [
        { field: "name", page: 0, x: 160, y: 200, size: 9, maxWidth: 250 },
        { field: "date", page: 0, x: 470, y: 200, size: 9, maxWidth: 70 },
        { field: "doctor", page: 0, x: 170, y: 133, size: 9, maxWidth: 210 },
        { field: "crm", page: 0, x: 422, y: 133, size: 9, maxWidth: 90 },
      ],
    },
    form: { status: "available", label: "Formulário médico oficial — Anemia na DRC", pages: [3] },
  },
  anemia_drc_ferro: {
    ter: {
      status: "available",
      label: "TER oficial — Sacarato de hidróxido férrico",
      pages: [4],
      overlay: [
        { field: "name", page: 0, x: 150, y: 224, size: 8, maxWidth: 260 },
        { field: "date", page: 0, x: 486, y: 224, size: 8, maxWidth: 70 },
        { field: "doctor", page: 0, x: 168, y: 155, size: 9, maxWidth: 210 },
        { field: "crm", page: 0, x: 420, y: 155, size: 9, maxWidth: 90 },
      ],
    },
    form: { status: "available", label: "Formulário médico oficial — Anemia na DRC", pages: [3] },
  },
  dmo_drc: {
    ter: {
      status: "available",
      label: "TER oficial — DMO-DRC",
      pages: [6],
      overlay: [
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
    },
    form: {
      status: "available",
      label: "Formulário de acesso oficial — DMO-DRC",
      pages: [7, 8],
      overlay: [
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
  },
  sindrome_nefrotica_pediatrica: {
    ter: {
      status: "available",
      label: "TER oficial — Síndrome Nefrótica Primária (crianças e adolescentes)",
      pages: [9],
    },
    form: {
      status: "available",
      label: "Formulário de acesso oficial — Síndrome Nefrótica Primária em crianças",
      pages: [10],
    },
  },
  sindrome_nefrotica_adultos: {
    // Pacote SESAB atual (índice p.0) não inclui TER/formulário de adultos.
  },
  les: {
    ter: { status: "available", label: "TER oficial — LES", pages: [11, 12] },
    form: { status: "available", label: "Formulário de acesso oficial — LES", pages: [13, 14, 15] },
  },
};

function unavailable(label: string, reason: string): OfficialDocUnavailable {
  return { status: "unavailable", label, reason };
}

export function getProtocolOfficialDocs(protocolId: string): ProtocolOfficialPack {
  const known = CEAF_PROTOCOLS.some((p) => p.id === protocolId);
  const mapped = PROTOCOL_OFFICIAL_DOCS[protocolId];
  const adultReason = protocolId === "sindrome_nefrotica_adultos" ? UNAVAILABLE_ADULT_SN : undefined;
  const missingReason =
    adultReason ||
    (!known
      ? "Protocolo não cadastrado no catálogo oficial."
      : "Este protocolo não tem TER/formulário oficial no pacote SESAB do Meu Rim. Não substituímos por outro.");

  return {
    protocolId,
    lme: LME_DOC,
    ter: mapped?.ter ?? unavailable("TER oficial", missingReason),
    form: mapped?.form ?? unavailable("Formulário oficial", missingReason),
    residence: RESIDENCE_DOC,
  };
}

export function officialDocSlot(protocolId: string, doc: OfficialDocKind): OfficialDocSlot {
  const pack = getProtocolOfficialDocs(protocolId);
  if (doc === "ter") return pack.ter;
  if (doc === "form") return pack.form;
  return pack.residence;
}

/** TER/formulário disponíveis em todos os protocolos do pacote SESAB. */
export function listAvailableOfficialDocs(doc: OfficialDocKind): { protocolId: string; label: string }[] {
  const seen = new Set<string>();
  const out: { protocolId: string; label: string }[] = [];
  for (const p of CEAF_PROTOCOLS) {
    const slot = officialDocSlot(p.id, doc);
    if (slot.status !== "available") continue;
    if (seen.has(slot.label)) continue;
    seen.add(slot.label);
    out.push({ protocolId: p.id, label: slot.label });
  }
  return out;
}

/** Compatível com a API: só devolve ref quando o arquivo oficial existe no pacote. */
export function officialDocPages(protocolId: string, doc: OfficialDocKind): OfficialDocRef | undefined {
  const slot = officialDocSlot(protocolId, doc);
  if (slot.status !== "available") return undefined;
  return { label: slot.label, pages: slot.pages };
}

export function terOverlay(protocolId: string): OverlayField[] {
  const ter = getProtocolOfficialDocs(protocolId).ter;
  return ter.status === "available" ? ter.overlay ?? [] : [];
}

export function formOverlay(protocolId: string): OverlayField[] {
  const form = getProtocolOfficialDocs(protocolId).form;
  return form.status === "available" ? form.overlay ?? [] : [];
}

export function officialOverlay(protocolId: string, doc: OfficialDocKind): OverlayField[] {
  if (doc === "ter") return terOverlay(protocolId);
  if (doc === "form") return formOverlay(protocolId);
  return [];
}

/** @deprecated use terOverlay — mantido para imports antigos. */
export const TER_OVERLAY: Record<string, OverlayField[]> = Object.fromEntries(
  Object.keys(PROTOCOL_OFFICIAL_DOCS).map((id) => [id, terOverlay(id)]),
);

export const OFFICIAL_OVERLAY: Record<string, { ter?: OverlayField[]; form?: OverlayField[] }> =
  Object.fromEntries(
    Object.keys(PROTOCOL_OFFICIAL_DOCS).map((id) => [
      id,
      { ter: terOverlay(id), form: formOverlay(id) },
    ]),
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
  if (/sacarato|hidroxido ferrico/.test(blob)) return "anemia_drc_ferro";
  if (/micofenolato|azatioprina/.test(blob)) return "les";
  if (/tacrolimo/.test(blob)) return "sindrome_nefrotica_pediatrica";
  if (/ciclofosfamida|ciclosporina/.test(blob)) return "sindrome_nefrotica_adultos";
  return undefined;
}

export const CEAF_RESIDENCIA_DOC: OfficialDocRef = { label: RESIDENCE_DOC.label, pages: RESIDENCE_DOC.pages };

export const CEAF_OFFICIAL_DOCS: Record<string, { ter?: OfficialDocRef; form?: OfficialDocRef }> = Object.fromEntries(
  Object.entries(PROTOCOL_OFFICIAL_DOCS).map(([id, docs]) => [
    id,
    {
      ter: docs.ter ? { label: docs.ter.label, pages: docs.ter.pages } : undefined,
      form: docs.form ? { label: docs.form.label, pages: docs.form.pages } : undefined,
    },
  ]),
);

const catalogIds = CEAF_PROTOCOLS.map((p) => p.id).sort().join("|");
const mappedIds = Object.keys(PROTOCOL_OFFICIAL_DOCS).sort().join("|");
if (catalogIds !== mappedIds) {
  throw new Error(
    `CEAF: o mapa de documentos oficiais está dessincronizado do catálogo (${mappedIds} ≠ ${catalogIds}).`,
  );
}
