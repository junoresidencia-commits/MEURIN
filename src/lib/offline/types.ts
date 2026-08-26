/** Tipos do modo offline (consulta médica). Sem dados em localStorage. */

export const OFFLINE_DB = "meurim-offline-v1";
export const OFFLINE_DB_VERSION = 1;
export const SNAPSHOT_TTL_MS = 72 * 60 * 60 * 1000;
export const MAX_SNAPSHOTS = 8;

export type OfflineOpKind = "note.create" | "profile.put" | "document.generate" | "lab.create";

export type OfflineOpStatus = "pending" | "syncing" | "error" | "conflict";

export interface OfflineSession {
  doctorId: string;
  doctorName: string;
  cachedAt: string;
}

export interface ChartSnapshot {
  key: string; // doctorId::patientKey
  doctorId: string;
  patientKey: string;
  patient: {
    email?: string | null;
    name: string;
    city?: string | null;
    phone?: string | null;
    birthdate?: string | null;
    sex?: string | null;
    cns?: string | null;
    cpf?: string | null;
  };
  notes: Array<{
    id: string;
    doctorName: string;
    chiefComplaint?: string | null;
    history?: string | null;
    assessment?: string | null;
    plan?: string | null;
    sharedWithPatient: boolean;
    createdAt: string;
    pending?: boolean;
  }>;
  labs: Array<{ id: string; testKey: string; value: number; unit?: string | null; measuredAt: string }>;
  documents: Array<{ id: string; type: string; title: string; createdAt: string }>;
  profile: Record<string, unknown>;
  profileUpdatedAt: string | null;
  cachedAt: string;
  expiresAt: string;
}

export interface OfflineDraft {
  key: string; // doctorId::patientKey::kind
  doctorId: string;
  patientKey: string;
  kind: "evolucao" | "receita" | "relatorio" | "documento";
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface OfflineOp {
  id: string; // clientOpId (uuid) — idempotência no servidor
  doctorId: string;
  patientKey: string;
  kind: OfflineOpKind;
  label: string;
  payload: Record<string, unknown>;
  status: OfflineOpStatus;
  error?: string | null;
  conflict?: { serverUpdatedAt?: string | null; serverData?: unknown } | null;
  createdAt: string;
  attempts: number;
}

export type ConnectionUi =
  | "online"
  | "offline"
  | "syncing"
  | "synced"
  | "pending-error";
