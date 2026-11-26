import "server-only";
import { listPatientsByDoctor, clinicalKey } from "./patients-store";
import { listBookingsForDoctor } from "./store";
import { getClinicalNotes, getLabResults, getDocuments, getPatientData } from "./patient-store";
import { listUploads } from "./uploads-store";
import { identityKey, pickFirstVisit } from "./first-visit";
import {
  anonymizeFirstVisit,
  extractFirstVisitRecord,
  firstVisitStats,
  matchesFirstVisitFilters,
  type FirstVisitRecord,
} from "./first-visit-extract";

export { anonymizeFirstVisit, firstVisitStats, matchesFirstVisitFilters };
export type { FirstVisitFilters, FirstVisitRecord, FirstVisitStats } from "./first-visit-extract";

/** Uma linha por paciente (CPF quando houver), sem misturar clínicas nem retornos. */
export async function buildFirstVisitRecords(doctorId: string): Promise<FirstVisitRecord[]> {
  const [patients, bookings] = await Promise.all([
    listPatientsByDoctor(doctorId),
    listBookingsForDoctor(doctorId),
  ]);

  type Cand = {
    patientId: string;
    patientKey: string;
    identity: string;
    name: string;
    cpf?: string | null;
    birthdate?: string | null;
    ageYears?: number | null;
    ageReportedAt?: string | null;
    sex?: string | null;
    address?: string | null;
    diseases?: string | null;
    medications?: string | null;
    registeredAt?: string | null;
    emails: string[];
  };

  const byIdentity = new Map<string, Cand>();
  const push = (c: Cand) => {
    const prev = byIdentity.get(c.identity);
    if (!prev) {
      byIdentity.set(c.identity, c);
      return;
    }
    prev.emails = Array.from(new Set([...prev.emails, ...c.emails]));
    if (!prev.cpf && c.cpf) prev.cpf = c.cpf;
    if (!prev.address && c.address) prev.address = c.address;
    if (!prev.birthdate && c.birthdate) prev.birthdate = c.birthdate;
    if (!prev.sex && c.sex) prev.sex = c.sex;
    if (c.registeredAt && (!prev.registeredAt || c.registeredAt < prev.registeredAt)) prev.registeredAt = c.registeredAt;
  };

  for (const p of patients) {
    if (p.status === "archived") continue;
    const key = clinicalKey(p);
    push({
      patientId: p.id,
      patientKey: key,
      identity: identityKey(p.cpf, key),
      name: p.name,
      cpf: p.cpf,
      birthdate: p.birthdate,
      ageYears: p.ageYears,
      ageReportedAt: p.ageReportedAt,
      sex: p.sex,
      address: p.address,
      diseases: p.diseases,
      medications: p.medications,
      registeredAt: p.createdAt,
      emails: [key, p.email || ""].filter(Boolean),
    });
  }

  const patientEmails = new Set(patients.map((p) => (p.email || "").toLowerCase()).filter(Boolean));
  const bookingEmails = new Map<string, typeof bookings[0]>();
  for (const b of bookings) {
    const em = (b.patientEmail || "").toLowerCase().trim();
    if (!em || patientEmails.has(em)) continue;
    if (!bookingEmails.has(em)) bookingEmails.set(em, b);
  }
  for (const [em, b] of bookingEmails) {
    push({
      patientId: em,
      patientKey: em,
      identity: identityKey(null, em),
      name: b.patientName,
      address: b.patientCity,
      registeredAt: b.createdAt,
      emails: [em],
    });
  }

  const records: FirstVisitRecord[] = [];
  for (const cand of byIdentity.values()) {
    const emails = Array.from(new Set(cand.emails.map((e) => e.toLowerCase().trim()).filter(Boolean)));
    const mineBookings = bookings.filter((b) => emails.includes((b.patientEmail || "").toLowerCase().trim()));
    const key = cand.patientKey;
    const chartKeys = emails.length ? emails : [key];
    const [notes, labs, docs, data] = await Promise.all([
      mergeAll(chartKeys, (k) => getClinicalNotes(k)),
      mergeAll(chartKeys, (k) => getLabResults(k)),
      mergeAll(chartKeys, (k) => getDocuments(k)),
      mergeVitals(chartKeys),
    ]);
    const uploads = await mergeAll(chartKeys, (k) => listUploads(k).catch(() => []));

    const anchor = pickFirstVisit({
      bookings: mineBookings,
      notes,
      doctorId,
      registeredAt: cand.registeredAt,
    });
    if (!anchor) continue;

    records.push(
      extractFirstVisitRecord({
        patientId: cand.patientId,
        patientKey: key,
        identityKey: cand.identity,
        name: cand.name,
        birthdate: cand.birthdate,
        ageYears: cand.ageYears,
        ageReportedAt: cand.ageReportedAt,
        sex: cand.sex,
        address: cand.address,
        diseases: cand.diseases,
        medications: cand.medications,
        anchor,
        notes,
        labs,
        docs,
        uploads,
        vitals: data,
        doctorId,
      })
    );
  }

  records.sort((a, b) => a.visitAt.localeCompare(b.visitAt));
  return records;
}

async function mergeAll<T extends { id?: string }>(keys: string[], load: (k: string) => Promise<T[]>): Promise<T[]> {
  const chunks = await Promise.all(keys.map((k) => load(k).catch(() => [] as T[])));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of chunks.flat()) {
    const id = String((row as { id?: string }).id || JSON.stringify(row));
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

async function mergeVitals(keys: string[]): Promise<{ kind: string; systolic?: number | null; diastolic?: number | null; measuredAt: string }[]> {
  const chunks = await Promise.all(
    keys.map((k) =>
      getPatientData(k, 80).catch(() => ({ records: [] as { kind: string; systolic?: number | null; diastolic?: number | null; measuredAt: string }[] }))
    )
  );
  return chunks.flatMap((c) => c.records);
}
