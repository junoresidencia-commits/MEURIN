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

export type TerOverlayField = "name" | "doctor" | "crm" | "date" | "cpf" | "birth";
export type TerField = { field: TerOverlayField; page: number; x: number; y: number; size?: number };

export type OfficialDocAvailable = OfficialDocRef & {
  status: "available";
  overlay?: TerField[];
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
        { field: "name", page: 0, x: 160, y: 200, size: 9 },
        { field: "date", page: 0, x: 470, y: 200, size: 9 },
        { field: "doctor", page: 0, x: 170, y: 133, size: 9 },
        { field: "crm", page: 0, x: 422, y: 133, size: 9 },
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
        { field: "name", page: 0, x: 150, y: 224, size: 8 },
        { field: "date", page: 0, x: 486, y: 224, size: 8 },
        { field: "doctor", page: 0, x: 168, y: 155, size: 9 },
        { field: "crm", page: 0, x: 420, y: 155, size: 9 },
      ],
    },
    form: { status: "available", label: "Formulário médico oficial — Anemia na DRC", pages: [3] },
  },
  dmo_drc: {
    ter: { status: "available", label: "TER oficial — DMO-DRC", pages: [6] },
    form: { status: "available", label: "Formulário de acesso oficial — DMO-DRC", pages: [7, 8] },
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

/** Compatível com a API: só devolve ref quando o arquivo oficial existe no pacote. */
export function officialDocPages(protocolId: string, doc: OfficialDocKind): OfficialDocRef | undefined {
  const slot = officialDocSlot(protocolId, doc);
  if (slot.status !== "available") return undefined;
  return { label: slot.label, pages: slot.pages };
}

export function terOverlay(protocolId: string): TerField[] {
  const ter = getProtocolOfficialDocs(protocolId).ter;
  return ter.status === "available" ? ter.overlay ?? [] : [];
}

/** @deprecated use terOverlay — mantido para imports antigos. */
export const TER_OVERLAY: Record<string, TerField[]> = Object.fromEntries(
  Object.keys(PROTOCOL_OFFICIAL_DOCS).map((id) => [id, terOverlay(id)]),
);

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
