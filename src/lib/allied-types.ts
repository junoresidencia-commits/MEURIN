/** Tipos da equipe assistencial (psicologia + enfermagem). Nutrição permanece no módulo próprio. */

export const ALLIED_ROLES = ["psychology", "nursing"] as const;
export type AlliedRole = (typeof ALLIED_ROLES)[number];

export const ROLE_META: Record<AlliedRole, { label: string; plural: string; registry: string; path: string; area: string }> = {
  psychology: { label: "Psicologia", plural: "Psicólogos", registry: "CRP", path: "/psicologo", area: "psico" },
  nursing: { label: "Enfermagem", plural: "Enfermeiros", registry: "COREN", path: "/enfermeiro", area: "enfermagem" },
};

export type AlliedStatus = "pending" | "active" | "inactive" | "rejected" | "suspended";

export interface AlliedProfessional {
  id: string;
  role: AlliedRole;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  registry?: string | null;
  uf?: string | null;
  specialty?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  passwordHash?: string | null;
  status: AlliedStatus;
  createdAt: string;
  lastAccessAt?: string | null;
}

export interface AlliedLink {
  id: string;
  professionalId: string;
  doctorId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlliedReferral {
  id: string;
  role: AlliedRole;
  doctorId: string;
  doctorName?: string | null;
  professionalId: string;
  patientKey: string;
  patientName?: string | null;
  reason?: string | null;
  notes?: string | null;
  status: "aberto" | "atendido" | "encerrado";
  createdAt: string;
}

export type AlliedNoteKind = "anamnese" | "evolucao" | "avaliacao";

export interface AlliedNote {
  id: string;
  role: AlliedRole;
  kind: AlliedNoteKind;
  professionalId: string;
  professionalName: string;
  registry?: string | null;
  patientKey: string;
  title?: string | null;
  body: string;
  payload: Record<string, unknown>;
  /** Psicologia: se false, o médico só vê que houve atendimento, não o conteúdo. */
  shareWithTeam: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string | null;
}

export const DEFAULT_ALLIED_PASSWORD = "123456";

export function normalizeCpf(cpf?: string | null): string {
  return String(cpf || "").replace(/\D/g, "");
}
