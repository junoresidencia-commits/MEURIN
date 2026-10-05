import "server-only";
import {
  createPatient,
  findDuplicatePatient,
  findPatientByClinicalKey,
  findByEmailAny,
  updatePatient,
  clinicalKey,
  isUnassignedDoctorId,
  type Patient,
} from "./patients-store";
import { parseAgeYears } from "./patient-age";
import { upsertProfessionalLink } from "./network-referrals-store";
import type { NetworkActor, ProfessionalKind } from "./network-types";

export function patientKeyOf(patient: Patient): string {
  return clinicalKey(patient);
}

/**
 * Quando o paciente marca consulta ou retorno, vira paciente daquele profissional:
 * prontuário e dados ficam acessíveis. Não tira o paciente de outro médico —
 * só assume o cadastro se ainda não houver dono.
 */
export async function attachPatientToProfessional(input: {
  kind: ProfessionalKind;
  professionalId: string;
  sessionSubject?: string | null;
  patientKey?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  origin?: "booking" | "return_request" | "registered" | "followup";
}): Promise<Patient | null> {
  const email = (input.email || "").toLowerCase().trim();
  const session = (input.sessionSubject || "").trim();
  const explicitKey = (input.patientKey || "").trim();

  let patient: Patient | null = null;
  if (explicitKey) patient = await findPatientByClinicalKey(explicitKey);
  if (!patient && session) {
    patient = session.includes("@") ? await findByEmailAny(session) : await findPatientByClinicalKey(session);
  }
  if (!patient && email) patient = await findByEmailAny(email);
  if (!patient) return null;

  const patch: Parameters<typeof updatePatient>[1] = {};
  if (input.kind === "doctor" && isUnassignedDoctorId(patient.doctorId)) {
    patch.doctorId = input.professionalId;
  }
  if (!patient.email && email) patch.email = email;
  if (!patient.phone && input.phone) patch.phone = String(input.phone).trim();
  if (input.name && !patient.name) patch.name = String(input.name).trim();
  if (Object.keys(patch).length > 0) {
    patient = (await updatePatient(patient.id, patch)) || patient;
  }

  try {
    await upsertProfessionalLink({
      patientKey: patientKeyOf(patient),
      patientName: patient.name || input.name || "Paciente",
      professionalKind: input.kind,
      professionalId: input.professionalId,
      origin: input.origin || "followup",
      referralId: null,
    });
  } catch (err) {
    console.error("[network] vínculo ao marcar atendimento", err);
  }
  return patient;
}

export async function registerOrLinkPatient(
  actor: NetworkActor,
  body: Record<string, unknown>
): Promise<{ patient: Patient; linkedExisting: boolean; matchedBy?: string }> {
  const name = String(body.name || "").trim();
  if (!name) throw Object.assign(new Error("Nome completo é obrigatório."), { status: 400 });

  const birthdate =
    body.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(String(body.birthdate)) ? String(body.birthdate) : null;
  const ageYears = !birthdate ? parseAgeYears(body.ageYears != null ? body.ageYears : body.age) : null;
  const ageReportedAt =
    !birthdate && ageYears != null
      ? body.ageReportedAt && /^\d{4}-\d{2}(-\d{2})?$/.test(String(body.ageReportedAt))
        ? String(body.ageReportedAt).length === 7
          ? `${body.ageReportedAt}-01`
          : String(body.ageReportedAt)
        : new Date().toISOString().slice(0, 10)
      : null;

  const input = {
    name,
    cpf: body.cpf ? String(body.cpf) : null,
    phone: body.phone ? String(body.phone) : null,
    email: body.email ? String(body.email) : null,
    birthdate,
  };

  const dup = await findDuplicatePatient(input);
  if (dup) {
    const existing = dup.patient;
    if (actor.kind === "doctor" && isUnassignedDoctorId(existing.doctorId)) {
      await updatePatient(existing.id, {
        doctorId: actor.id,
        name: name || existing.name,
        phone: input.phone || existing.phone,
        email: input.email || existing.email,
        birthdate: birthdate || existing.birthdate,
      });
    }
    const key = patientKeyOf(existing);
    await upsertProfessionalLink({
      patientKey: key,
      patientName: existing.name,
      professionalKind: actor.kind,
      professionalId: actor.id,
      origin: "followup",
      referralId: null,
    });
    return { patient: existing, linkedExisting: true, matchedBy: dup.matchedBy };
  }

  const patient = await createPatient({
    doctorId: actor.kind === "doctor" ? actor.id : "",
    name,
    cpf: input.cpf,
    cns: body.cns ? String(body.cns).replace(/\s+/g, "") : null,
    motherName: body.motherName ? String(body.motherName) : null,
    birthdate,
    ageYears,
    ageReportedAt,
    sex: body.sex ? String(body.sex) : null,
    phone: input.phone,
    email: input.email,
    address: body.address ? String(body.address) : null,
    emergencyContact: body.emergencyContact ? String(body.emergencyContact) : null,
    guardianName: body.guardianName ? String(body.guardianName) : null,
    guardianPhone: body.guardianPhone ? String(body.guardianPhone) : null,
    insurance: body.insurance ? String(body.insurance) : null,
    allergies: body.allergies ? String(body.allergies) : null,
    diseases: body.diseases ? String(body.diseases) : null,
    medications: body.medications ? String(body.medications) : null,
    notes: body.notes ? String(body.notes) : null,
  });

  try {
    await upsertProfessionalLink({
      patientKey: patientKeyOf(patient),
      patientName: patient.name,
      professionalKind: actor.kind,
      professionalId: actor.id,
      origin: "registered",
      referralId: null,
    });
  } catch (err) {
    console.error("[network] vínculo após cadastro", err);
    if (actor.kind !== "doctor") throw err;
  }

  return { patient, linkedExisting: false };
}

export async function resolvePatientForActor(actor: NetworkActor, rawKey: string): Promise<Patient | null> {
  const patient = await findPatientByClinicalKey(rawKey);
  if (patient) return patient;
  void actor;
  return null;
}
