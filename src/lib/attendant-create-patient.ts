import "server-only";
import {
  clinicalKey,
  createPatient,
  findDuplicatePatient,
  isUnassignedDoctorId,
  updatePatient,
  type Patient,
} from "./patients-store";
import { upsertProfessionalLink } from "./network-referrals-store";
import { logAttendantAudit } from "./attendants-store";

export type AttendantPatientDraft = {
  name: string;
  cpf?: string | null;
  cns?: string | null;
  motherName?: string | null;
  birthdate?: string | null;
  ageYears?: number | null;
  ageReportedAt?: string | null;
  sex?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type AttendantCreatePatientResult = {
  patient: Patient;
  created: boolean;
  linkedExisting: boolean;
  alreadyOnDoctor: boolean;
  matchedBy?: string;
};

function isUniqueConflict(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "23505") return true;
  return /duplicate key|unique constraint|already exists/i.test(e.message || "");
}

async function attachQuietly(opts: {
  patient: Patient;
  doctorId: string;
  attendantId: string;
  attendantName: string;
  detail: string;
  origin: "registered" | "followup";
}) {
  try {
    await upsertProfessionalLink({
      patientKey: clinicalKey(opts.patient),
      patientName: opts.patient.name,
      professionalKind: "doctor",
      professionalId: opts.doctorId,
      origin: opts.origin,
      referralId: null,
    });
  } catch (err) {
    console.error("[atendente] vínculo profissional", err);
  }
  try {
    await logAttendantAudit({
      attendantId: opts.attendantId,
      attendantName: opts.attendantName,
      doctorId: opts.doctorId,
      action: "criar_paciente",
      patientKey: opts.patient.id,
      detail: opts.detail,
    });
  } catch (err) {
    console.error("[atendente] auditoria", err);
  }
}

async function claimIfUnassigned(patient: Patient, doctorId: string, draft: AttendantPatientDraft): Promise<Patient> {
  if (!isUnassignedDoctorId(patient.doctorId)) return patient;
  const linked = await updatePatient(patient.id, {
    doctorId,
    name: draft.name || patient.name,
    phone: draft.phone ? String(draft.phone) : patient.phone,
    email: draft.email ? String(draft.email) : patient.email,
    birthdate: draft.birthdate || patient.birthdate,
    sex: draft.sex ? String(draft.sex) : patient.sex,
    address: draft.address ? String(draft.address) : patient.address,
    cns: draft.cns ? String(draft.cns) : patient.cns,
    motherName: draft.motherName ? String(draft.motherName) : patient.motherName,
  });
  return linked || { ...patient, doctorId };
}

/** Cria o paciente para o médico ou reusa o cadastro que já existe (CPF/e-mail/telefone). */
export async function resolveOrCreatePatientForDoctor(input: {
  doctorId: string;
  attendantId: string;
  attendantName: string;
  draft: AttendantPatientDraft;
}): Promise<AttendantCreatePatientResult> {
  const { doctorId, attendantId, attendantName, draft } = input;
  const existing = await findDuplicatePatient({
    cpf: draft.cpf,
    email: draft.email,
    phone: draft.phone,
    birthdate: draft.birthdate,
    name: draft.name,
  });

  if (existing) {
    const wasUnassigned = isUnassignedDoctorId(existing.patient.doctorId);
    const patient = await claimIfUnassigned(existing.patient, doctorId, draft);
    const alreadyOnDoctor = patient.doctorId === doctorId;
    await attachQuietly({
      patient,
      doctorId,
      attendantId,
      attendantName,
      origin: alreadyOnDoctor || wasUnassigned ? "registered" : "followup",
      detail: alreadyOnDoctor
        ? `Reusou paciente ${patient.name} já do médico.`
        : `Vinculou paciente ${patient.name} ao médico.`,
    });
    return {
      patient,
      created: false,
      linkedExisting: true,
      alreadyOnDoctor,
      matchedBy: existing.matchedBy,
    };
  }

  try {
    const patient = await createPatient({
      doctorId,
      name: draft.name,
      cpf: draft.cpf || null,
      cns: draft.cns || null,
      motherName: draft.motherName || null,
      birthdate: draft.birthdate || null,
      ageYears: draft.ageYears ?? null,
      ageReportedAt: draft.ageReportedAt || null,
      sex: draft.sex || null,
      phone: draft.phone || null,
      email: draft.email || null,
      address: draft.address || null,
    });
    await attachQuietly({
      patient,
      doctorId,
      attendantId,
      attendantName,
      origin: "registered",
      detail: `Criou paciente ${draft.name}.`,
    });
    return { patient, created: true, linkedExisting: false, alreadyOnDoctor: true };
  } catch (err) {
    if (!isUniqueConflict(err)) throw err;
    const again = await findDuplicatePatient({
      cpf: draft.cpf,
      email: draft.email,
      phone: draft.phone,
      birthdate: draft.birthdate,
      name: draft.name,
    });
    if (!again) throw err;
    const patient = await claimIfUnassigned(again.patient, doctorId, draft);
    await attachQuietly({
      patient,
      doctorId,
      attendantId,
      attendantName,
      origin: "followup",
      detail: `Reusou paciente ${patient.name} após conflito de cadastro.`,
    });
    return {
      patient,
      created: false,
      linkedExisting: true,
      alreadyOnDoctor: patient.doctorId === doctorId,
      matchedBy: again.matchedBy,
    };
  }
}
