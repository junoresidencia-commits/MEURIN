/** Tipos do motor documental — client-safe.
 *  A tela só apresenta; regras de negócio ficam no DocumentWorkflowService. */

export type DocumentCategory =
  | "receita"
  | "exame"
  | "relatorio"
  | "laudo"
  | "atestado"
  | "encaminhamento"
  | "declaracao"
  | "parecer"
  | "orientacao"
  | "livre"
  | "lme"
  | "ter"
  | "formulario_oficial"
  | "consentimento"
  | "administrativo";

export type DocumentWorkflowState =
  | "DRAFT"
  | "MISSING_DATA"
  | "AWAITING_CONSENT"
  | "READY_TO_SIGN"
  | "SIGNING"
  | "AWAITING_MANUAL_SIGNATURE"
  | "DIGITALLY_SIGNED"
  | "MANUALLY_SIGNED"
  | "VALIDATED"
  | "RELEASED"
  | "CANCELLED"
  | "SUPERSEDED";

export type SignatureMethodKind = "DIGITAL" | "MANUAL" | "EXTERNAL_OFFICIAL_FLOW";

export type SignatureProviderId = "vidaas" | "cfm" | "manual" | "none";

export type RequirementKind = "ERROR" | "REQUIRED_PENDING" | "WARNING" | "INFORMATION";

export type ConsentCategory =
  | "assistencial"
  | "tratamento"
  | "esclarecimento"
  | "dados"
  | "compartilhamento"
  | "responsavel_legal"
  | "pesquisa"
  | "contato_pesquisa";

export type WorkflowItemStatus = "ok" | "pending" | "warning" | "na";

export interface DocumentDefinition {
  id: string;
  name: string;
  category: DocumentCategory;
  description: string;
  active: boolean;
  official: boolean;
  authority?: string;
  source?: string;
  templateId?: string;
  templateVersion?: string;
  effectiveDate?: string;
  requiresDoctorSignature: boolean;
  requiresPatientSignature: boolean;
  requiresGuardianSignature: boolean;
  allowedSignatureMethods: SignatureMethodKind[];
  applicableProtocols?: string[];
  canPrint: boolean;
  canDownload: boolean;
  canShare: boolean;
  canSendWhatsapp: boolean;
  canSendEmail: boolean;
  canSendToPatient: boolean;
  /** Caminhos que o teste antissumiço confere (arquivo no repo). */
  integrityPaths: string[];
  /** Rotas HTTP que o teste antissumiço confere. */
  integrityRoutes: string[];
}

export interface WorkflowItem {
  id: string;
  definitionId: string;
  label: string;
  status: WorkflowItemStatus;
  state: DocumentWorkflowState | "NOT_STARTED";
  kind: RequirementKind;
  href?: string;
  documentId?: string;
  lmeId?: string;
  detail?: string;
}

export interface ConsentRequirement {
  id: string;
  category: ConsentCategory;
  label: string;
  requiredForCare: boolean;
  accepted: boolean;
  version?: string;
  href?: string;
}

export interface EncounterWorkflow {
  patientKey: string;
  items: WorkflowItem[];
  consents: ConsentRequirement[];
  missing: WorkflowItem[];
  canFinalizeEncounter: boolean;
  pendingCount: number;
  summary: string;
}

export interface SignatureSession {
  id: string;
  documentId: string | null;
  patientKey: string;
  doctorId: string;
  provider: SignatureProviderId;
  method: SignatureMethodKind;
  status: "started" | "awaiting_upload" | "completed" | "failed" | "expired";
  originalHash?: string | null;
  startedAt: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  providerReference?: string | null;
  errorCode?: string | null;
  errorMessageSanitized?: string | null;
  idempotencyKey: string;
}

export const WORKFLOW_STATE_LABEL: Record<DocumentWorkflowState, string> = {
  DRAFT: "Rascunho",
  MISSING_DATA: "Faltam dados",
  AWAITING_CONSENT: "Aguardando consentimento",
  READY_TO_SIGN: "Pronto para assinar",
  SIGNING: "Assinatura em andamento",
  AWAITING_MANUAL_SIGNATURE: "Aguardando assinatura manual",
  DIGITALLY_SIGNED: "Assinado digitalmente",
  MANUALLY_SIGNED: "Assinatura manual registrada",
  VALIDATED: "Assinatura validada",
  RELEASED: "Liberado ao paciente",
  CANCELLED: "Cancelado",
  SUPERSEDED: "Substituído por nova versão",
};

export const WORKFLOW_STATE_TONE: Record<DocumentWorkflowState, "green" | "blue" | "yellow" | "red" | "neutral"> = {
  DRAFT: "neutral",
  MISSING_DATA: "yellow",
  AWAITING_CONSENT: "yellow",
  READY_TO_SIGN: "yellow",
  SIGNING: "yellow",
  AWAITING_MANUAL_SIGNATURE: "yellow",
  DIGITALLY_SIGNED: "green",
  MANUALLY_SIGNED: "blue",
  VALIDATED: "green",
  RELEASED: "green",
  CANCELLED: "red",
  SUPERSEDED: "neutral",
};
