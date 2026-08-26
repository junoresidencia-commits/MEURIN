import { getSnapshot, loadSession, saveSnapshot, snapshotExpiry, snapshotKey } from "./idb";
import type { ChartSnapshot } from "./types";

type SnapIn = {
  doctorId: string;
  patientKey: string;
  patient: ChartSnapshot["patient"];
  notes: ChartSnapshot["notes"];
  labs: ChartSnapshot["labs"];
  documents?: ChartSnapshot["documents"];
  profile?: Record<string, unknown>;
  profileUpdatedAt?: string | null;
};

/** Guarda só o essencial da consulta. Sem PDF, sem URL assinada, sem uploads. */
export async function cacheChartSnapshot(input: SnapIn): Promise<void> {
  const now = new Date().toISOString();
  const labs = [...input.labs]
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    .slice(0, 40);
  const notes = input.notes.slice(0, 30).map((n) => ({
    id: n.id,
    doctorName: n.doctorName,
    chiefComplaint: n.chiefComplaint ?? null,
    history: n.history ?? null,
    assessment: n.assessment ?? null,
    plan: n.plan ?? null,
    sharedWithPatient: Boolean(n.sharedWithPatient),
    createdAt: n.createdAt,
    pending: n.pending,
  }));
  await saveSnapshot({
    key: snapshotKey(input.doctorId, input.patientKey),
    doctorId: input.doctorId,
    patientKey: decodeURIComponent(input.patientKey),
    patient: {
      email: input.patient.email ?? null,
      name: input.patient.name,
      city: input.patient.city ?? null,
      phone: input.patient.phone ?? null,
      birthdate: input.patient.birthdate ?? null,
      sex: input.patient.sex ?? null,
      cns: input.patient.cns ?? null,
      cpf: input.patient.cpf ?? null,
    },
    notes,
    labs,
    documents: (input.documents || []).slice(0, 20).map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      createdAt: d.createdAt,
    })),
    profile: input.profile || {},
    profileUpdatedAt: input.profileUpdatedAt ?? null,
    cachedAt: now,
    expiresAt: snapshotExpiry(),
  });
}

export async function getCachedChartSnapshot(patientKey: string): Promise<ChartSnapshot | null> {
  const sess = await loadSession();
  if (!sess) return null;
  return getSnapshot(sess.doctorId, patientKey);
}

/** Atualiza o cache local sem perder o restante do prontuário já gravado. */
export async function mergeIntoSnapshot(
  doctorId: string,
  patientKey: string,
  patch: {
    notes?: ChartSnapshot["notes"];
    profile?: Record<string, unknown>;
    documents?: ChartSnapshot["documents"];
    profileUpdatedAt?: string | null;
  }
): Promise<void> {
  const snap = await getSnapshot(doctorId, patientKey);
  if (!snap) return;
  const extraNotes = patch.notes || [];
  const notes = [
    ...extraNotes.filter((n) => !snap.notes.some((s) => s.id === n.id)),
    ...snap.notes,
  ];
  const extraDocs = patch.documents || [];
  const documents = [
    ...extraDocs.filter((d) => !snap.documents.some((s) => s.id === d.id)),
    ...snap.documents,
  ];
  await cacheChartSnapshot({
    doctorId,
    patientKey: snap.patientKey,
    patient: snap.patient,
    notes,
    labs: snap.labs,
    documents,
    profile: patch.profile ? { ...snap.profile, ...patch.profile } : snap.profile,
    profileUpdatedAt: patch.profileUpdatedAt !== undefined ? patch.profileUpdatedAt : snap.profileUpdatedAt,
  });
}
