import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { createClinic, addMembership, listMemberships } from "../src/lib/platform-store";
import { inviteDoctor, inviteAttendant, acceptInvite, getInviteByToken } from "../src/lib/clinic-ops-store";
import { upsertFeeRule, recordProductionFromAttendance, recordCheckIn, listEncounters, productionSummary } from "../src/lib/clinic-finance-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  const before = await collectIntegrityCounts();
  const db0 = await readDb();
  const carlos = db0.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos, "seed do Dr. Carlos permanece");
  const carlosId = carlos.id;
  const carlosHash = carlos.passwordHash;
  const doctorsBefore = db0.doctors.length;

  const clinic = await createClinic({ name: "Salute Fase 2", city: "Salvador" });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });

  const existing = await inviteDoctor({
    clinicId: clinic.id,
    name: "Dr. Carlos",
    email: "carlos@meurim.com",
    crm: "CRM-SP 123456",
    invitedBy: carlos.id,
  });
  assert.equal(existing.linkedExisting, true);
  assert.equal(existing.actorId, carlosId);
  assert.equal(existing.invite.status, "accepted");

  const afterLink = await readDb();
  assert.equal(afterLink.doctors.length, doctorsBefore, "vínculo de médico existente não cria usuário");
  assert.equal(afterLink.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(afterLink.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);

  const pending = await inviteDoctor({
    clinicId: clinic.id,
    name: "Dra. Nova Convite",
    email: "nova.convite@meurim.com",
    crm: "CRM-BA 999",
    specialty: "Nefrologia",
    invitedBy: carlos.id,
  });
  assert.equal(pending.linkedExisting, false);
  assert.equal(pending.invite.status, "pending");
  const mid = await readDb();
  assert.equal(mid.doctors.length, doctorsBefore, "convite pendente não cria médico");
  assert.equal(mid.doctors.some((d) => d.email === "nova.convite@meurim.com"), false);

  const accepted = await acceptInvite(pending.invite.token, "senha-da-medica");
  assert.equal(accepted.actorKind, "doctor");
  const afterAccept = await readDb();
  const nova = afterAccept.doctors.find((d) => d.email === "nova.convite@meurim.com");
  assert.ok(nova, "médica criada só depois de ela definir a senha");
  assert.notEqual(nova.id, carlosId);
  assert.equal(afterAccept.doctors.find((d) => d.email === "carlos@meurim.com")?.id, carlosId);
  assert.equal(afterAccept.doctors.find((d) => d.email === "carlos@meurim.com")?.passwordHash, carlosHash);
  const used = await getInviteByToken(pending.invite.token);
  assert.equal(used?.status, "accepted");

  const members = await listMemberships(clinic.id);
  assert.ok(members.some((m) => m.actorId === carlosId && m.role === "ADMIN_CLINICA"));
  assert.ok(members.some((m) => m.actorId === nova.id && m.role === "MEDICO"));

  const attInvite = await inviteAttendant({
    clinicId: clinic.id,
    name: "Ana Balcão",
    email: "ana.balcao@meurim.com",
    invitedBy: carlos.id,
  });
  assert.equal(attInvite.linkedExisting, false);
  await acceptInvite(attInvite.invite.token, "senha-atendente");

  const rule = await upsertFeeRule({ clinicId: clinic.id, doctorId: nova.id, feeCents: 45000, clinicSharePercent: 20 });
  assert.equal(rule.feeCents, 45000);

  const enc = await recordProductionFromAttendance({
    doctorId: nova.id,
    patientKey: "paciente.fase3@meurim.com",
    patientName: "Paciente Fase 3",
  });
  assert.ok(enc);
  assert.equal(enc.feeCents, 45000);
  assert.equal(enc.receivedCents, 0);
  assert.equal(enc.paymentStatus, "pending");
  assert.equal(enc.clinicShareCents, 9000);
  assert.equal(enc.doctorShareCents, 36000);

  const again = await recordProductionFromAttendance({
    doctorId: nova.id,
    patientKey: "paciente.fase3@meurim.com",
  });
  assert.equal(again?.id, enc.id, "não duplica produção no mesmo dia");

  const check = await recordCheckIn({
    clinicId: clinic.id,
    encounterId: enc.id,
    method: "pix",
    amountCents: 45000,
    recordedByKind: "attendant",
  });
  assert.equal(check.encounter.receivedCents, 45000);
  assert.equal(check.encounter.paymentStatus, "paid");

  const list = await listEncounters(clinic.id);
  const summary = productionSummary(list);
  assert.equal(summary.count, 1);
  assert.equal(summary.producedCents, 45000);
  assert.equal(summary.receivedCents, 45000);

  const noClinic = await recordProductionFromAttendance({
    doctorId: carlosId,
    patientKey: "outro@meurim.com",
  });
  // Carlos é ADMIN_CLINICA desta clínica (1 clínica) — pode gerar produção.
  // Garante que médico sem clínica não quebra: criamos um segundo médico seed (Ana) sem membership extra.
  const ana = afterAccept.doctors.find((d) => d.email === "ana@meurim.com");
  if (ana) {
    const skipped = await recordProductionFromAttendance({ doctorId: ana.id, patientKey: "x@y.com" });
    assert.equal(skipped, null, "médico sem clínica não gera produção");
  }
  void noClinic;

  const after = await collectIntegrityCounts();
  const dropped = countsDropped(before, after);
  assert.equal(dropped.length, 0, `contagem clínica diminuiu: ${dropped.join(", ")}`);
  assert.ok(after.doctors >= before.doctors);

  console.log("clinic-ops-finance ok", {
    clinicId: clinic.id,
    carlosId,
    novaId: nova.id,
    produced: summary.producedCents,
    received: summary.receivedCents,
    doctors: after.doctors,
    patients: after.patients,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
