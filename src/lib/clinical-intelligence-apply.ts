import "server-only";
import { extractClinicalFields } from "./clinical-intelligence";
import { getProfile } from "./clinical-profile-store";
import { getClinicalNotes, getLabResults } from "./patient-store";
import { clinicalKey, findPatientByClinicalKey, listPatientsByDoctor } from "./patients-store";
import { readDb } from "./store";
import { listSharesForDoctor } from "./patient-shares-store";
import { getEffectivePrefs } from "./intelligence-prefs-store";
import { suggestForReview } from "./intelligence-prefs";

export type IntelligenceAuditRow = {
  patientKey: string;
  name: string;
  extracted: number;
  applied: number;
  pending: number;
  conflicts: number;
  status: "ok" | "review";
  at: string;
};

function noteText(n: { chiefComplaint?: string | null; history?: string | null; assessment?: string | null; plan?: string | null }) {
  return [n.chiefComplaint, n.history, n.assessment, n.plan].filter(Boolean).join("\n");
}

export async function reprocessPatient(
  patientKey: string,
  doctorId: string | null,
  nameHint?: string
): Promise<IntelligenceAuditRow> {
  const key = patientKey.toLowerCase().trim();
  const [notes, labs, cadastro, current] = await Promise.all([
    getClinicalNotes(key),
    getLabResults(key),
    findPatientByClinicalKey(key),
    getProfile(key),
  ]);
  const blob = [
    cadastro?.diseases,
    cadastro?.medications,
    cadastro?.allergies,
    cadastro?.notes,
    ...notes.map(noteText),
  ]
    .filter(Boolean)
    .join("\n\n");

  const detected = extractClinicalFields(blob, labs.map((l) => ({ testKey: l.testKey, value: l.value, measuredAt: l.measuredAt })), current?.data);
  const prefs = doctorId ? await getEffectivePrefs(doctorId) : null;
  const suggest = prefs ? suggestForReview(detected, prefs) : detected.filter((d) => d.confidence !== "baixa");

  const before = current?.data || {};
  let conflicts = 0;
  if (current?.meta) {
    for (const field of suggest) {
      if (current.meta[field.key]?.source === "manual" && String(before[field.key] ?? "") !== String(field.value ?? "")) {
        conflicts++;
      }
    }
  }

  // Nunca grava no perfil aqui. Relê só para o médico revisar.
  return {
    patientKey: key,
    name: nameHint || cadastro?.name || key,
    extracted: detected.length,
    applied: 0,
    pending: suggest.length,
    conflicts,
    status: suggest.length || conflicts ? "review" : "ok",
    at: new Date().toISOString(),
  };
}

export async function listDoctorPatientKeys(doctorId: string): Promise<{ key: string; name: string }[]> {
  const created = await listPatientsByDoctor(doctorId);
  const rows: { key: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const p of created) {
    if (p.status === "archived") continue;
    const k = clinicalKey(p);
    seen.add(k);
    rows.push({ key: k, name: p.name });
  }
  const db = await readDb();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const email = b.patientEmail.toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    rows.push({ key: email, name: b.patientName });
  }
  const { incoming } = await listSharesForDoctor(doctorId);
  for (const share of incoming.filter((s) => s.status === "active")) {
    if (seen.has(share.patientKey)) continue;
    seen.add(share.patientKey);
    rows.push({ key: share.patientKey, name: share.patientName || share.patientKey });
  }
  return rows;
}

export async function reprocessDoctorPatients(doctorId: string): Promise<IntelligenceAuditRow[]> {
  const prefs = await getEffectivePrefs(doctorId);
  if (!prefs.allowBackfill) return [];
  const list = await listDoctorPatientKeys(doctorId);
  const out: IntelligenceAuditRow[] = [];
  for (const p of list) {
    try {
      out.push(await reprocessPatient(p.key, doctorId, p.name));
    } catch (e) {
      out.push({
        patientKey: p.key,
        name: p.name,
        extracted: 0,
        applied: 0,
        pending: 0,
        conflicts: 1,
        status: "review",
        at: new Date().toISOString(),
      });
      console.error("[intelligence] reprocess", p.key, e);
    }
  }
  return out;
}
