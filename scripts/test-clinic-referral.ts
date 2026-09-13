import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import { createShare, revokeShare } from "../src/lib/patient-shares-store";
import {
  cancelReferralsForShare,
  countPatientLinks,
  findSharedClinics,
  listClinicPeersForDoctor,
  listReferrals,
  recordIntraClinicReferral,
} from "../src/lib/clinic-referral-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  const ana = db0.doctors.find((d) => d.email === "ana@meurim.com");
  const pedro = db0.doctors.find((d) => d.email === "pedro@meurim.com");
  assert.ok(carlos && ana && pedro);
  const carlosId = carlos.id;
  const carlosHash = carlos.passwordHash;
  const patientsBefore = before.patients;

  const clinic = await createClinic({ name: "Rede Cuidado Teste", city: "Salvador" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "MEDICO" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: ana.id, role: "MEDICO" });

  const shared = await findSharedClinics(carlos.id, ana.id);
  assert.equal(shared.some((c) => c.id === clinic.id), true);
  assert.equal((await findSharedClinics(carlos.id, pedro.id)).length, 0);

  const peers = await listClinicPeersForDoctor(carlos.id);
  assert.equal(peers.some((p) => p.id === ana.id), true, "Ana da mesma clínica aparece na rede");
  assert.equal(peers.some((p) => p.id === pedro.id), false, "Pedro fora da clínica não entra na rede");

  const patientKey = `fase5.rede.${Date.now()}@meurim.local`;
  const intra = await createShare({
    patientKey,
    patientName: "Paciente Rede",
    fromDoctorId: carlos.id,
    fromDoctorName: carlos.name,
    fromSpecialty: carlos.specialty,
    toDoctorId: ana.id,
    toDoctorName: ana.name,
    toSpecialty: ana.specialty,
    reason: "Avaliação conjunta na clínica",
  });
  const referral = await recordIntraClinicReferral({ share: intra, preferredClinicId: clinic.id });
  assert.ok(referral);
  assert.equal(referral.clinicId, clinic.id);
  assert.equal(referral.shareId, intra.id);
  assert.equal(referral.patientKey, patientKey);
  assert.equal(referral.status, "active");

  const again = await recordIntraClinicReferral({ share: intra, preferredClinicId: clinic.id });
  assert.equal(again?.id, referral.id, "não duplica encaminhamento ativo");

  const listed = await listReferrals(clinic.id);
  assert.equal(listed.some((r) => r.id === referral.id), true);
  assert.equal(await countPatientLinks(clinic.id), 1, "vínculo pontual só do encaminhado");
  assert.ok(await countPatientLinks(clinic.id) < 10, "sem backfill dos pacientes atuais");

  const outside = await createShare({
    patientKey: `fase5.fora.${Date.now()}@meurim.local`,
    patientName: "Paciente Fora",
    fromDoctorId: carlos.id,
    fromDoctorName: carlos.name,
    fromSpecialty: carlos.specialty,
    toDoctorId: pedro.id,
    toDoctorName: pedro.name,
    toSpecialty: pedro.specialty,
    reason: "Fora da clínica",
  });
  const noClinic = await recordIntraClinicReferral({ share: outside });
  assert.equal(noClinic, null, "share fora da clínica não vira referral");
  assert.equal((await listReferrals(clinic.id)).filter((r) => r.shareId === outside.id).length, 0);

  await revokeShare(intra.id, carlos.id);
  await cancelReferralsForShare(intra.id);
  const afterCancel = (await listReferrals(clinic.id)).find((r) => r.id === referral.id);
  assert.equal(afterCancel?.status, "cancelled");

  const after = await readDb();
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(after.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const counts = await collectIntegrityCounts();
  assert.equal(counts.patients, patientsBefore, "nenhum paciente criado ou apagado");
  const dropped = countsDropped(before, counts);
  assert.equal(dropped.length, 0, dropped.join(", "));

  console.log("clinic-referral ok", { clinic: clinic.name, referral: referral.id, links: 1 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
