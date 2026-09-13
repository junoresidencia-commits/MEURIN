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

export type ClinicStatus = "active" | "suspended" | "draft";
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
};

export const FOUNDER_SUPER_ADMIN_EMAIL = (
  process.env.PLATFORM_SUPER_ADMIN_EMAIL || "junoresidencia@gmail.com"
).toLowerCase();
