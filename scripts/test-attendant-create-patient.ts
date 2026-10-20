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
  const { createPatient, listPatientsByDoctor, clinicalKey } = await import("../src/lib/patients-store");
  const { upsertProfessionalLink, listLinksForProfessional } = await import("../src/lib/network-referrals-store");
  const { createClinic, addMembership } = await import("../src/lib/platform-store");
  const { syncAttendantClinicDoctors } = await import("../src/lib/clinic-ops-store");

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
