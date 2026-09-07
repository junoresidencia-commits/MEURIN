import "server-only";
import { extractClinicalFields, findingsToChanges, splitByConfidence } from "./clinical-intelligence";
import { applyProfileChanges, getProfile } from "./clinical-profile-store";
import { aFromRac, refineG } from "./kdigo";
import { getClinicalNotes, getLabResults } from "./patient-store";
import { clinicalKey, findPatientByClinicalKey, listPatientsByDoctor } from "./patients-store";
import { readDb } from "./store";
import { listSharesForDoctor } from "./patient-shares-store";

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
  const { auto, review } = splitByConfidence(detected);
  const changes = findingsToChanges([...auto, ...review.filter((r) => r.autoApply)]);

  const latestTfge = [...labs].filter((l) => l.testKey === "tfge").sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  const latestRac = [...labs].filter((l) => l.testKey === "rac").sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  if (latestRac) {
    const a = aFromRac(latestRac.value);
    if (a) changes.categoria_a = a;
  }
  if (latestTfge) {
    const g = refineG(typeof changes.estagio_g === "string" ? changes.estagio_g : String(current?.data.estagio_g || ""), latestTfge.value);
    if (g) changes.estagio_g = g;
  }

  const before = current?.data || {};
  let conflicts = 0;
  if (current?.meta) {
    for (const field of Object.keys(changes)) {
      if (current.meta[field]?.source === "manual" && String(before[field] ?? "") !== String(changes[field] ?? "")) {
        conflicts++;
      }
    }
  }

  await applyProfileChanges(key, doctorId, doctorId, changes, "evolução", { respectPriority: true });
  if (latestTfge && changes.estagio_g) {
    await applyProfileChanges(key, doctorId, doctorId, { estagio_g: changes.estagio_g }, "cálculo", { respectPriority: true });
  }

  const pending = review.filter((r) => !r.autoApply).length;
  return {
    patientKey: key,
    name: nameHint || cadastro?.name || key,
    extracted: detected.length,
    applied: Object.keys(changes).length,
    pending,
    conflicts,
    status: pending || conflicts ? "review" : "ok",
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
