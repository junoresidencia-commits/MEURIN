/** Papéis de plataforma / clínica. Um ator pode ter vários. */

export const PLATFORM_ROLES = [
  "SUPER_ADMIN",
  "ADMIN_CLINICA",
  "MEDICO",
  "ATENDENTE",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ACTOR_KINDS = ["doctor", "attendant"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export type ClinicStatus = "active" | "pilot" | "suspended" | "draft";
export const CLINIC_STATUSES: ClinicStatus[] = ["active", "pilot", "suspended", "draft"];
export type MembershipStatus = "active" | "invited" | "revoked";

export type PlatformRoleAssignment = {
  id: string;
  actorKind: ActorKind;
  actorId: string;
  role: PlatformRole;
  grantedBy: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type Clinic = {
  id: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  city: string | null;
  status: ClinicStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClinicMembership = {
  id: string;
  clinicId: string;
  actorKind: ActorKind;
  actorId: string;
  role: PlatformRole;
  status: MembershipStatus;
  permissions: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAuditEntry = {
  id: string;
  actorKind: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
};

export type InviteKind = "doctor" | "attendant";
export type InviteStatus = "pending" | "accepted" | "cancelled" | "expired";

export type ClinicInvite = {
  id: string;
  clinicId: string;
  kind: InviteKind;
  email: string;
  name: string;
  crm: string | null;
  specialty: string | null;
  token: string;
  status: InviteStatus;
  invitedBy: string | null;
  acceptedActorId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  /** Valor desta clínica (não o preço do médico em outra cidade). */
  feeCents?: number | null;
  /** % da clínica neste vínculo. O restante é o médico. */
  clinicSharePercent?: number | null;
};

export type ClinicFeeRule = {
  id: string;
  clinicId: string;
  doctorId: string;
  feeCents: number;
  clinicSharePercent: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EncounterPaymentStatus = "pending" | "paid" | "partial" | "courtesy";
export type ClinicPaymentMethod = "pix" | "card" | "cash" | "courtesy" | "other";

export type ClinicEncounter = {
  id: string;
  clinicId: string;
  doctorId: string;
  patientKey: string;
  patientName: string | null;
  bookingId: string | null;
  feeCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  receivedCents: number;
  paymentStatus: EncounterPaymentStatus;
  attendedAt: string;
  createdAt: string;
};

export type ClosingStatus = "closed" | "paid";
export type AdjustmentKind = "credit" | "debit" | "correction";

export type ClinicClosing = {
  id: string;
  clinicId: string;
  doctorId: string;
  code: string;
  periodFrom: string;
  periodTo: string;
  encounterIds: string[];
  producedCents: number;
  receivedCents: number;
  clinicShareCents: number;
  doctorShareCents: number;
  status: ClosingStatus;
  createdBy: string | null;
  paidAt: string | null;
  paidBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicClosingAdjustment = {
  id: string;
  closingId: string;
  clinicId: string;
  kind: AdjustmentKind;
  amountCents: number;
  reason: string;
  createdByKind: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

export type ClinicPayment = {
  id: string;
  clinicId: string;
  encounterId: string;
  method: ClinicPaymentMethod;
  amountCents: number;
  discountCents: number;
  status: EncounterPaymentStatus;
  note: string | null;
  recordedByKind: string | null;
  recordedById: string | null;
  createdAt: string;
};

export type ClinicFinanceEventKind =
  | "fee_rule"
  | "checkin"
  | "closing"
  | "payout"
  | "adjustment"
  | "expense"
  | "expense_correction"
  | "cash_close"
  | "receipt"
  | "nfse_request"
  | "nfse_issue"
  | "nfse_cancel"
  | "nfse_attach";

export type ClinicFinanceEvent = {
  id: string;
  clinicId: string;
  kind: ClinicFinanceEventKind;
  entity: string;
  entityId: string;
  beforeCents: number | null;
  afterCents: number | null;
  reason: string | null;
  actorKind: string | null;
  actorId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

export type ClinicReferralStatus = "active" | "cancelled";

export type ClinicReferral = {
  id: string;
  clinicId: string;
  shareId: string | null;
  patientKey: string;
  patientName: string | null;
  fromDoctorId: string;
  fromDoctorName: string | null;
  fromSpecialty: string | null;
  toDoctorId: string;
  toDoctorName: string | null;
  toSpecialty: string | null;
  reason: string | null;
  status: ClinicReferralStatus;
  createdAt: string;
  cancelledAt: string | null;
};

export type ClinicPatientLink = {
  id: string;
  clinicId: string;
  patientKey: string;
  source: string;
  createdAt: string;
};

export type ClinicPeerDoctor = {
  id: string;
  name: string;
  specialty: string;
  crm?: string;
  clinics: { id: string; name: string }[];
};

export type IntegrityCounts = {
  doctors: number;
  patients: number;
  bookings: number;
  clinicalNotes: number;
  documents: number;
  labResults: number;
  clinics: number;
  memberships: number;
  roleAssignments: number;
  saasPlans: number;
  saasLicenses: number;
};

export type SaasLicenseStatus = "trial" | "active" | "past_due" | "canceled";

export type SaasPlan = {
  id: string;
  name: string;
  monthlyCents: number;
  doctorSeats: number;
  features: Record<string, boolean>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaasLicense = {
  id: string;
  planId: string;
  clinicId: string | null;
  doctorId: string | null;
  status: SaasLicenseStatus;
  periodStart: string | null;
  periodEnd: string | null;
  monthlyCents: number;
  createdAt: string;
  updatedAt: string;
  canceledAt: string | null;
};

export type SaasMrrSnapshot = {
  id: string;
  yearMonth: string;
  mrrCents: number;
  licensesActive: number;
  createdAt: string;
};

export const FOUNDER_SUPER_ADMIN_EMAIL = (
  process.env.PLATFORM_SUPER_ADMIN_EMAIL || "junoresidencia@gmail.com"
).toLowerCase();

/** Permissões financeiras da clínica (gestora configura no vínculo). Ausente = padrão do papel. */
export const CLINIC_CASH_PERM_KEYS = [
  "expense",
  "close_cash",
  "receipt",
  "nfse_request",
  "finance_view",
] as const;
export type ClinicCashPermKey = (typeof CLINIC_CASH_PERM_KEYS)[number];

export const CLINIC_STOCK_PERM_KEYS = [
  "stock_view",
  "stock_out",
  "stock_in",
  "stock_request",
  "stock_manage",
] as const;
export type ClinicStockPermKey = (typeof CLINIC_STOCK_PERM_KEYS)[number];

export const CLINIC_EXPENSE_CATEGORIES = [
  "material_medico",
  "material_escritorio",
  "limpeza",
  "medicamentos",
  "manutencao",
  "alimentacao",
  "transporte",
  "pagamento_funcionario",
  "taxas",
  "outros",
] as const;
export type ClinicExpenseCategory = (typeof CLINIC_EXPENSE_CATEGORIES)[number];

export const CLINIC_EXPENSE_METHODS = [
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "transferencia",
  "outro",
] as const;
export type ClinicExpenseMethod = (typeof CLINIC_EXPENSE_METHODS)[number];

export const CLINIC_CASH_ORIGINS = [
  "caixa_fisico",
  "conta_clinica",
  "pix_clinica",
  "outro",
] as const;
export type ClinicCashOrigin = (typeof CLINIC_CASH_ORIGINS)[number];

export type ClinicExpense = {
  id: string;
  clinicId: string;
  occurredAt: string;
  amountCents: number;
  category: ClinicExpenseCategory;
  description: string;
  method: ClinicExpenseMethod;
  origin: ClinicCashOrigin;
  responsibleName: string;
  locationLabel: string | null;
  notes: string | null;
  attachmentPath: string | null;
  attachmentStorage: "supabase" | "local" | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  correctedFromId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByKind: string | null;
  voidedById: string | null;
  recordedByKind: string | null;
  recordedById: string | null;
  recordedByEmail: string | null;
  createdAt: string;
};

export type ClinicCashSession = {
  id: string;
  clinicId: string;
  day: string;
  openingCents: number;
  inCents: number;
  outCents: number;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  justification: string | null;
  byMethod: Record<string, number>;
  closedByKind: string | null;
  closedById: string | null;
  closedByName: string | null;
  closedByEmail: string | null;
  createdAt: string;
};

export type ClinicFiscalKind = "recibo" | "nfse";
export type ClinicNfseStatus =
  | "not_requested"
  | "pending"
  | "issuing"
  | "issued"
  | "error"
  | "cancelled";
export type ClinicFiscalStatus = "issued" | ClinicNfseStatus;

export type ClinicFiscalDoc = {
  id: string;
  clinicId: string;
  encounterId: string | null;
  patientKey: string;
  kind: ClinicFiscalKind;
  status: ClinicFiscalStatus;
  amountCents: number;
  serviceLabel: string;
  paymentMethod: string | null;
  patientName: string;
  patientCpf: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  patientAddress: string | null;
  doctorId: string | null;
  doctorName: string | null;
  doctorCrm: string | null;
  clinicName: string | null;
  number: string | null;
  issuedAt: string | null;
  providerRef: string | null;
  errorMessage: string | null;
  pdfPath: string | null;
  pdfStorage: "supabase" | "local" | null;
  xmlPath: string | null;
  xmlStorage: "supabase" | "local" | null;
  xmlName: string | null;
  requestedByKind: string | null;
  requestedById: string | null;
  requestedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};
