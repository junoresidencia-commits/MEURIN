/** Solicitação de retorno: o paciente pede, o profissional valida, o sistema classifica. */

export const RETURN_HABITUAL_DAYS = 30;

export const RETURN_PROFESSIONAL_KINDS = ["doctor", "nutrition", "psychology", "nursing"] as const;
export type ReturnProfessionalKind = (typeof RETURN_PROFESSIONAL_KINDS)[number];

export const RETURN_STATUSES = [
  "pending_review",
  "awaiting_patient",
  "suggested_slot",
  "confirmed_return",
  "awaiting_payment",
  "confirmed_new",
  "refused",
  "refused_deadline",
  "cancelled",
  "closed",
] as const;
export type ReturnRequestStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_DECISIONS = [
  "confirm_return",
  "confirm_return_exception",
  "convert_new",
  "suggest_slot",
  "ask_info",
  "invite_attendant",
  "refuse",
  "refuse_deadline",
] as const;
export type ReturnDecision = (typeof RETURN_DECISIONS)[number];

export const LAST_VISIT_SOURCES = ["registered", "patient_reported"] as const;
export type LastVisitSource = (typeof LAST_VISIT_SOURCES)[number];

export const LAST_VISIT_APPROX = ["date", "month_year", "unknown"] as const;
export type LastVisitApprox = (typeof LAST_VISIT_APPROX)[number];

export const DEADLINE_REFUSAL_MESSAGE =
  "Sua solicitação de retorno não foi aprovada, pois já se passaram mais de 30 dias desde a sua última consulta.\n\nPara continuar o acompanhamento, será necessário realizar uma nova consulta, com o pagamento correspondente.";

export const ASK_INFO_MESSAGE =
  "Não localizei seu atendimento anterior. Poderia informar aproximadamente quando e onde você foi atendido?";

export const STATUS_LABEL: Record<ReturnRequestStatus, string> = {
  pending_review: "Aguardando confirmação do profissional",
  awaiting_patient: "Aguardando sua resposta",
  suggested_slot: "Novo horário sugerido",
  confirmed_return: "Retorno confirmado",
  awaiting_payment: "Aguardando pagamento",
  confirmed_new: "Nova consulta confirmada",
  refused: "Solicitação recusada",
  refused_deadline: "Retorno não aprovado — prazo de 30 dias ultrapassado",
  cancelled: "Solicitação cancelada",
  closed: "Atendimento encerrado",
};

export const STATUS_TONE: Record<ReturnRequestStatus, "yellow" | "orange" | "blue" | "green" | "pay" | "red" | "gray"> = {
  pending_review: "yellow",
  awaiting_patient: "orange",
  suggested_slot: "blue",
  confirmed_return: "green",
  awaiting_payment: "pay",
  confirmed_new: "green",
  refused: "red",
  refused_deadline: "red",
  cancelled: "gray",
  closed: "gray",
};

export const STATUS_HINT: Record<ReturnRequestStatus, string> = {
  pending_review: "Seu pedido ainda está sendo avaliado.",
  awaiting_patient: "O profissional solicitou alguma informação.",
  suggested_slot: "O profissional propôs outra data ou horário.",
  confirmed_return: "Seu atendimento foi aprovado como retorno.",
  awaiting_payment: "O atendimento foi convertido em nova consulta e existe uma etapa financeira pendente.",
  confirmed_new: "Sua nova consulta está confirmada.",
  refused: "A solicitação não foi aprovada.",
  refused_deadline: "Sua última consulta ultrapassou o período de 30 dias para retorno. Para continuar o acompanhamento, será necessário realizar uma nova consulta.",
  cancelled: "Você cancelou esta solicitação.",
  closed: "O atendimento já foi concluído.",
};

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function newConsultHref(kind: ReturnProfessionalKind, professionalId: string): string {
  if (kind === "doctor") return `/agendar?medico=${encodeURIComponent(professionalId)}`;
  return `/paciente/agendar/${kind}/${professionalId}?tipo=consulta`;
}

export function returnRequestPatientPath(requestId: string): string {
  return `/paciente/retorno/${requestId}`;
}

export function returnRequestProfessionalPath(kind: ReturnProfessionalKind, requestId: string): string {
  if (kind === "doctor") return `/medicos/solicitacoes/${requestId}`;
  if (kind === "nutrition") return `/nutricionista/solicitacoes/${requestId}`;
  if (kind === "psychology") return `/psicologo/solicitacoes/${requestId}`;
  return `/enfermeiro/solicitacoes/${requestId}`;
}

export const KIND_LABEL: Record<ReturnProfessionalKind, string> = {
  doctor: "Médico(a)",
  nutrition: "Nutricionista",
  psychology: "Psicólogo(a)",
  nursing: "Enfermeiro(a)",
};

export interface ReturnRequest {
  id: string;
  professionalKind: ReturnProfessionalKind;
  professionalId: string;
  professionalName: string;
  professionalSpecialty?: string | null;
  patientKey: string;
  patientName: string;
  patientEmail?: string | null;
  requestedSlotStart: string;
  requestedSlotEnd: string;
  requestedKind: "retorno";
  status: ReturnRequestStatus;
  lastVisitAt?: string | null;
  lastVisitSource?: LastVisitSource | null;
  lastVisitLocation?: string | null;
  lastVisitApprox?: LastVisitApprox | null;
  daysSinceLast?: number | null;
  withinHabitual?: boolean | null;
  patientNote?: string | null;
  suggestedSlotStart?: string | null;
  suggestedSlotEnd?: string | null;
  decision?: ReturnDecision | null;
  decisionBy?: string | null;
  decisionAt?: string | null;
  refusalReason?: string | null;
  autoMessage?: string | null;
  exceptionalAfter30?: boolean;
  convertedToNew?: boolean;
  bookingId?: string | null;
  priceCents?: number | null;
  paymentStatus?: string | null;
  chatOpen: boolean;
  attendantInvited: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
}

export interface ReturnMessage {
  id: string;
  requestId: string;
  authorRole: "patient" | "professional" | "attendant" | "system";
  authorId: string;
  authorName: string;
  body: string;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  createdAt: string;
}

export interface ReturnEvent {
  id: string;
  requestId: string;
  at: string;
  actor: string;
  type: string;
  detail?: string | null;
}

export function isReturnProfessionalKind(v: unknown): v is ReturnProfessionalKind {
  return RETURN_PROFESSIONAL_KINDS.includes(v as ReturnProfessionalKind);
}

export function isReturnStatus(v: unknown): v is ReturnRequestStatus {
  return RETURN_STATUSES.includes(v as ReturnRequestStatus);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

export function habitualWindow(days: number | null | undefined): { within: boolean; label: string } {
  if (days == null) {
    return { within: false, label: "Sem registro da consulta anterior no Meu Rim." };
  }
  if (days <= RETURN_HABITUAL_DAYS) {
    return { within: true, label: "Dentro do período habitual de retorno." };
  }
  return {
    within: false,
    label: "O período habitual de retorno de 30 dias já foi ultrapassado.",
  };
}

export function titlePrefix(name: string, kind: ReturnProfessionalKind): string {
  const n = name.trim();
  if (kind !== "doctor") return n;
  if (/^dr\.?\s/i.test(n) || /^dra\.?\s/i.test(n)) return n;
  return `Dr. ${n}`;
}
