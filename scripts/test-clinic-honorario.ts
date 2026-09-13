import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { createClinic, addMembership } from "../src/lib/platform-store";
import { inviteDoctor } from "../src/lib/clinic-ops-store";
import { getFeeRule, recordProductionFromAttendance, productionSummary } from "../src/lib/clinic-finance-store";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const db = await readDb();
  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);

  const salute = await createClinic({ name: "Salute", city: "Salvador" });
  const outra = await createClinic({ name: "Outra Cidade", city: "Feira" });
  await addMembership({ clinicId: salute.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: outra.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });

  await inviteDoctor({
    clinicId: salute.id,
    name: carlos.name,
    email: carlos.email,
    invitedBy: carlos.id,
    feeCents: 45000,
    clinicSharePercent: 30,
  });
  await inviteDoctor({
    clinicId: outra.id,
    name: carlos.name,
    email: carlos.email,
    invitedBy: carlos.id,
    feeCents: 55000,
    clinicSharePercent: 20,
  });

  const a = await getFeeRule(salute.id, carlos.id);
  const b = await getFeeRule(outra.id, carlos.id);
  assert.equal(a?.feeCents, 45000);
  assert.equal(a?.clinicSharePercent, 30);
  assert.equal(b?.feeCents, 55000);
  assert.equal(b?.clinicSharePercent, 20);

  const enc = await recordProductionFromAttendance({
    doctorId: carlos.id,
    patientKey: `honorario.${Date.now()}@meurim.com`,
    patientName: "Paciente Honorário",
  });
  assert.equal(enc, null, "duas clínicas: não adivinha qual regra usar");

  const summary = productionSummary([]);
  assert.equal(summary.clinicShareCents, 0);
  assert.equal(summary.doctorShareCents, 0);

  console.log("clinic-honorario ok", {
    salute: { fee: a?.feeCents, share: a?.clinicSharePercent },
    outra: { fee: b?.feeCents, share: b?.clinicSharePercent },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
