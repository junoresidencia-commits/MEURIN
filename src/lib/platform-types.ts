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
