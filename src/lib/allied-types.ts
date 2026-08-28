/** Tipos da equipe assistencial. Nutrição permanece no módulo próprio. */

export const ALLIED_ROLES = ["psychology", "nursing", "cardiology", "endocrinology", "physician"] as const;
export type AlliedRole = (typeof ALLIED_ROLES)[number];

export function emptyAlliedMap<T>(make: () => T): Record<AlliedRole, T> {
  return Object.fromEntries(ALLIED_ROLES.map((r) => [r, make()])) as Record<AlliedRole, T>;
}

export const ROLE_META: Record<AlliedRole, {
  label: string;
  plural: string;
  title: string;
  referLabel: string;
  registry: string;
  path: string;
  area: string;
  notify: "psicologo" | "enfermeiro" | "cardiologista" | "endocrinologista" | "especialista";
  careLabel: string;
  assessmentTitle: string;
  emptyAssigned: string;
  shareByDefault: boolean;
  showLabs: boolean;
  hasCondutas: boolean;
}> = {
  psychology: {
    label: "Psicologia",
    plural: "Psicólogos",
    title: "Psicólogo(a)",
    referLabel: "psicóloga",
    registry: "CRP",
    path: "/psicologo",
    area: "psico",
    notify: "psicologo",
    careLabel: "psicólogo(a)",
    assessmentTitle: "Anamnese psicológica",
    emptyAssigned: "Nenhum psicólogo encaminhado",
    shareByDefault: false,
    showLabs: false,
    hasCondutas: false,
  },
  nursing: {
    label: "Enfermagem",
    plural: "Enfermeiros",
    title: "Enfermeiro(a)",
    referLabel: "enfermeira",
    registry: "COREN",
    path: "/enfermeiro",
    area: "enfermagem",
    notify: "enfermeiro",
    careLabel: "enfermeiro(a)",
    assessmentTitle: "Avaliação de enfermagem",
    emptyAssigned: "Nenhum enfermeiro encaminhado",
    shareByDefault: true,
    showLabs: true,
    hasCondutas: true,
  },
  cardiology: {
    label: "Cardiologia",
    plural: "Cardiologistas",
    title: "Cardiologista",
    referLabel: "cardiologista",
    registry: "CRM",
    path: "/cardiologista",
    area: "cardio",
    notify: "cardiologista",
    careLabel: "cardiologista",
    assessmentTitle: "Avaliação cardiológica",
    emptyAssigned: "Nenhum cardiologista encaminhado",
    shareByDefault: true,
    showLabs: true,
    hasCondutas: true,
  },
  endocrinology: {
    label: "Endocrinologia",
    plural: "Endocrinologistas",
    title: "Endocrinologista",
    referLabel: "endocrinologista",
    registry: "CRM",
    path: "/endocrinologista",
    area: "endocrino",
    notify: "endocrinologista",
    careLabel: "endocrinologista",
    assessmentTitle: "Avaliação endocrinológica",
    emptyAssigned: "Nenhum endocrinologista encaminhado",
    shareByDefault: true,
    showLabs: true,
    hasCondutas: true,
  },
  physician: {
    label: "Outro médico",
    plural: "Médicos especialistas",
    title: "Médico(a)",
    referLabel: "outro médico",
    registry: "CRM",
    path: "/especialista",
    area: "especialista",
    notify: "especialista",
    careLabel: "médico(a) especialista",
    assessmentTitle: "Avaliação clínica",
    emptyAssigned: "Nenhum outro médico encaminhado",
    shareByDefault: true,
    showLabs: true,
    hasCondutas: true,
  },
};

export function isAlliedRole(s: string): s is AlliedRole {
  return (ALLIED_ROLES as readonly string[]).includes(s);
}

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
