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
