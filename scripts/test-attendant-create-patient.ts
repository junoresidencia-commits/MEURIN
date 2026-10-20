import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

async function main() {
  const DATA = path.join(process.cwd(), "data");
  await mkdir(DATA, { recursive: true });
  await rm(path.join(DATA, "attendants.json"), { force: true });
  await rm(path.join(DATA, "patients.json"), { force: true });
  await rm(path.join(DATA, "network-referrals.json"), { force: true });

  const doctorId = "doc-atendente-teste";

  const { createAttendant, upsertLink, listLinksForAttendant, DEFAULT_PERMISSIONS } = await import("../src/lib/attendants-store");
  const { hasPerm } = await import("../src/lib/attendant-context");
  const { createPatient, listPatientsByDoctor, clinicalKey, UNASSIGNED_DOCTOR_ID } = await import("../src/lib/patients-store");
  const { upsertProfessionalLink, listLinksForProfessional } = await import("../src/lib/network-referrals-store");
  const { createClinic, addMembership } = await import("../src/lib/platform-store");
  const { syncAttendantClinicDoctors } = await import("../src/lib/clinic-ops-store");
  const { resolveOrCreatePatientForDoctor } = await import("../src/lib/attendant-create-patient");

  const att = await createAttendant({ name: "Ana Balcão", email: "ana.balcao@example.invalid", cpf: "529.982.247-25" });
  const link = await upsertLink(att.id, doctorId);
  assert.equal(link.active, true);
  assert.equal(hasPerm(link, "criarPaciente"), true);

  const missingPerms = { ...link, permissions: {} as typeof link.permissions };
  assert.equal(hasPerm(missingPerms, "criarPaciente"), true, "permissão ausente usa o padrão (criar paciente ligado)");
  const denied = { ...link, permissions: { ...DEFAULT_PERMISSIONS, criarPaciente: false } };
  assert.equal(hasPerm(denied, "criarPaciente"), false);

  const patient = await createPatient({
    doctorId,
    name: "Maria da Atendente",
    phone: "73999001122",
    email: "maria.atendente@example.invalid",
  });
  await upsertProfessionalLink({
    patientKey: clinicalKey(patient),
    patientName: patient.name,
    professionalKind: "doctor",
    professionalId: doctorId,
    origin: "registered",
    referralId: null,
  });

  const mine = await listPatientsByDoctor(doctorId);
  assert.ok(mine.some((p) => p.id === patient.id), "paciente criado pela atendente aparece na lista do médico");
  const prof = await listLinksForProfessional("doctor", doctorId);
  assert.ok(prof.some((l) => l.patientKey === clinicalKey(patient)));

  const first = await resolveOrCreatePatientForDoctor({
    doctorId,
    attendantId: att.id,
    attendantName: att.name,
    draft: { name: "João Novo", cpf: "390.533.447-05", phone: "73988001122", email: "joao.novo.at@example.invalid" },
  });
  assert.equal(first.created, true);
  assert.equal(first.linkedExisting, false);

  const sameDoctor = await resolveOrCreatePatientForDoctor({
    doctorId,
    attendantId: att.id,
    attendantName: att.name,
    draft: { name: "João Novo Cadastro", cpf: "390.533.447-05", phone: "73988001122" },
  });
  assert.equal(sameDoctor.created, false, "CPF já do médico não cria outro");
  assert.equal(sameDoctor.linkedExisting, true);
  assert.equal(sameDoctor.alreadyOnDoctor, true);
  assert.equal(sameDoctor.patient.id, first.patient.id);

  const selfRegistered = await createPatient({
    doctorId: UNASSIGNED_DOCTOR_ID,
    name: "Clara Sem Médico",
    cpf: "153.509.460-56",
    email: "clara.sem.medico@example.invalid",
  });
  const claimed = await resolveOrCreatePatientForDoctor({
    doctorId,
    attendantId: att.id,
    attendantName: att.name,
    draft: { name: "Clara Sem Médico", cpf: "153.509.460-56", email: "clara.sem.medico@example.invalid" },
  });
  assert.equal(claimed.created, false, "cadastro próprio é reusado");
  assert.equal(claimed.linkedExisting, true);
  assert.equal(claimed.patient.id, selfRegistered.id);
  assert.equal(claimed.patient.doctorId, doctorId, "paciente sem médico fica do médico da atendente");

  const otherDoctor = await createPatient({
    doctorId: "doc-outro-medico",
    name: "Pedro Outro",
    cpf: "529.982.247-25",
    email: "pedro.outro@example.invalid",
  });
  const linkedOther = await resolveOrCreatePatientForDoctor({
    doctorId,
    attendantId: att.id,
    attendantName: att.name,
    draft: { name: "Pedro Outro", cpf: "529.982.247-25" },
  });
  assert.equal(linkedOther.created, false, "CPF de outro médico não falha");
  assert.equal(linkedOther.linkedExisting, true);
  assert.equal(linkedOther.patient.id, otherDoctor.id);
  const afterOther = await listLinksForProfessional("doctor", doctorId);
  assert.ok(afterOther.some((l) => l.patientKey === clinicalKey(otherDoctor)), "vínculo profissional com o médico da atendente");

  const att2 = await createAttendant({ name: "Bia Clínica", email: "bia.clinica@example.invalid" });
  const clinic = await createClinic({ name: "Clínica Teste Atendente", city: "Irecê" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: doctorId, role: "MEDICO" });
  await addMembership({ clinicId: clinic.id, actorKind: "attendant", actorId: att2.id, role: "ATENDENTE" });
  assert.equal((await listLinksForAttendant(att2.id)).length, 0, "ainda sem vínculo direto");
  const added = await syncAttendantClinicDoctors(att2.id);
  assert.ok(added >= 1, "sync cria o vínculo com o médico da clínica");
  const synced = await listLinksForAttendant(att2.id);
  assert.ok(synced.some((l) => l.doctorId === doctorId));

  console.log("attendant-create-patient ok", { patientId: patient.id, doctorId, synced: added });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
