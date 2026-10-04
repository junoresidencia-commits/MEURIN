export const PROFESSIONAL_KINDS = ["doctor", "nutrition", "psychology", "nursing"] as const;
export type ProfessionalKind = (typeof PROFESSIONAL_KINDS)[number];

export const REFERRAL_STATUSES = [
  "pending_consent",
  "pending",
  "viewed",
  "accepted",
  "following",
  "finished",
  "declined",
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending_consent: "Aguardando autorização do paciente",
  pending: "Pendente",
  viewed: "Visualizado",
  accepted: "Aceito",
  following: "Em acompanhamento",
  finished: "Finalizado",
  declined: "Recusado",
};

export const CONSENT_METHODS = ["digital", "in_app", "e_sign", "term", "in_person", "other"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const CONSENT_METHOD_LABELS: Record<ConsentMethod, string> = {
  digital: "Consentimento digital pelo próprio paciente",
  in_app: "Confirmação dentro do aplicativo",
  e_sign: "Assinatura eletrônica",
  term: "Termo de consentimento",
  in_person: "Confirmação presencial registrada pelo profissional",
  other: "Outra forma válida",
};

export const SHARE_SLICES = [
  "clinicalSummary",
  "hypotheses",
  "diagnoses",
  "medications",
  "exams",
  "documents",
  "selectedNotes",
  "medicalReport",
  "reason",
] as const;
export type ShareSlice = (typeof SHARE_SLICES)[number];

export const SHARE_SLICE_LABELS: Record<ShareSlice, string> = {
  clinicalSummary: "Resumo clínico",
  hypotheses: "Hipóteses diagnósticas",
  diagnoses: "Diagnósticos",
  medications: "Medicamentos",
  exams: "Exames",
  documents: "Documentos",
  selectedNotes: "Evoluções selecionadas",
  medicalReport: "Relatório médico",
  reason: "Motivo do encaminhamento",
};

export const DEFAULT_SHARE_SLICES: ShareSlice[] = ["reason", "clinicalSummary"];

export const PROFESSION_LABELS: Record<ProfessionalKind, string> = {
  doctor: "Médico(a)",
  nutrition: "Nutricionista",
  psychology: "Psicólogo(a)",
  nursing: "Enfermeiro(a)",
};

export function isProfessionalKind(value: unknown): value is ProfessionalKind {
  return PROFESSIONAL_KINDS.includes(value as ProfessionalKind);
}

export function isReferralStatus(value: unknown): value is ReferralStatus {
  return REFERRAL_STATUSES.includes(value as ReferralStatus);
}

export function isConsentMethod(value: unknown): value is ConsentMethod {
  return CONSENT_METHODS.includes(value as ConsentMethod);
}

export function isShareSlice(value: unknown): value is ShareSlice {
  return SHARE_SLICES.includes(value as ShareSlice);
}

export function honorific(name: string, kind?: ProfessionalKind | null): string {
  const n = (name || "").trim() || "profissional";
  if (kind === "nutrition") return n.startsWith("Nutri") ? n : `Nutri ${n}`;
  return `Dr(a). ${n}`;
}

/** Cartão público — sem CPF, PIX, banco, e-mail, telefone ou endereço residencial. */
export interface ProfessionalPublicCard {
  id: string;
  kind: ProfessionalKind;
  name: string;
  professionalName: string;
  profession: string;
  specialty: string;
  registry: string | null;
  rqe: string | null;
  city: string | null;
  state: string | null;
  clinic: string | null;
  photoUrl: string | null;
  bio: string | null;
}

export interface NetworkActor {
  kind: ProfessionalKind;
  id: string;
  name: string;
  professionalName: string;
  profession: string;
  specialty: string;
  photoUrl: string | null;
  notifyRole: "medico";
}

export interface PatientNetworkReferral {
  id: string;
  patientKey: string;
  patientName: string | null;
  registeredByKind: ProfessionalKind | null;
  registeredById: string | null;
  registeredByName: string | null;
  fromKind: ProfessionalKind;
  fromId: string;
  fromName: string;
  fromProfession: string | null;
  fromSpecialty: string | null;
  toKind: ProfessionalKind;
  toId: string;
  toName: string;
  toProfession: string | null;
  toSpecialty: string | null;
  reason: string | null;
  notes: string | null;
  status: ReferralStatus;
  shareSlices: ShareSlice[];
  consentConfirmed: boolean;
  consentMethod: ConsentMethod | null;
  consentAt: string | null;
  consentByKind: string | null;
  consentById: string | null;
  consentByName: string | null;
  consentRevokedAt: string | null;
  shareId: string | null;
  createdAt: string;
  updatedAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  finishedAt: string | null;
}

export interface PatientNetworkReferralEvent {
  id: string;
  referralId: string;
  action: string;
  actorKind: string | null;
  actorId: string | null;
  actorName: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface PatientProfessionalLink {
  id: string;
  patientKey: string;
  patientName: string | null;
  professionalKind: ProfessionalKind;
  professionalId: string;
  origin: "registered" | "referral" | "followup";
  referralId: string | null;
  createdAt: string;
}
