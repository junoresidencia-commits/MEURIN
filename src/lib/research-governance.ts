/** Governança de pesquisa — client-safe. Separada do financeiro da clínica. */

export const ETHICS_STATUSES = ["none", "pending", "approved", "waived", "rejected"] as const;
export type EthicsStatus = (typeof ETHICS_STATUSES)[number];

export const CONSENT_STATUSES = ["pending", "given", "withdrawn", "not_required"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const ETHICS_LABEL: Record<EthicsStatus, string> = {
  none: "Sem registro",
  pending: "Em análise no CEP",
  approved: "Aprovado",
  waived: "Dispensa registrada",
  rejected: "Não aprovado",
};

export type ResearchProtocol = {
  id: string;
  studyId: string;
  doctorId: string;
  clinicId: string | null;
  ethicsStatus: EthicsStatus;
  protocolCode: string | null;
  ethicsBody: string | null;
  waiverReason: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchConsent = {
  id: string;
  studyId: string;
  doctorId: string;
  patientKey: string;
  patientName: string | null;
  status: ConsentStatus;
  recordedAt: string;
};

export type ExportGate = {
  ok: boolean;
  reason: string;
};

export function emptyProtocol(studyId: string, doctorId: string): ResearchProtocol {
  const now = new Date().toISOString();
  return {
    id: "",
    studyId,
    doctorId,
    clinicId: null,
    ethicsStatus: "none",
    protocolCode: null,
    ethicsBody: null,
    waiverReason: null,
    approvedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function canExportStudy(input: {
  ethicsStatus: EthicsStatus;
  protocolCode?: string | null;
  waiverReason?: string | null;
  studyType?: string;
  givenConsents?: number;
}): ExportGate {
  const status = input.ethicsStatus;
  if (status === "rejected") {
    return { ok: false, reason: "CEP/CONEP não aprovou este protocolo. A exportação fica bloqueada." };
  }
  if (status !== "approved" && status !== "waived") {
    return { ok: false, reason: "Registre aprovação do CEP/CONEP ou a dispensa antes de exportar." };
  }
  if (status === "approved" && !String(input.protocolCode || "").trim()) {
    return { ok: false, reason: "Informe o número do parecer/protocolo do CEP." };
  }
  if (status === "waived" && String(input.waiverReason || "").trim().length < 10) {
    return { ok: false, reason: "Dispensa exige o motivo (pelo menos 10 caracteres)." };
  }
  if (input.studyType === "coorte_prosp" && status !== "waived" && (input.givenConsents || 0) < 1) {
    return { ok: false, reason: "Coorte prospectiva exige consentimento registrado ou dispensa." };
  }
  return { ok: true, reason: "Exportação anonimizada liberada pela governança deste estudo." };
}
