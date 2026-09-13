import assert from "node:assert/strict";
import { readDb } from "../src/lib/store";
import { addMembership, createClinic } from "../src/lib/platform-store";
import { createEncounter, recordCheckIn, upsertFeeRule } from "../src/lib/clinic-finance-store";
import { collectIntegrityCounts, countsDropped } from "../src/lib/platform-integrity";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: não semear com env de produção. Desligue as duas variáveis.");
    process.exit(1);
  }
  const before = await collectIntegrityCounts();
  const db = await readDb();
  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos);

  const a = await createClinic({ name: "Clínica Teste A", city: "Salvador", status: "pilot" });
  const b = await createClinic({ name: "Clínica Teste B", city: "Recife", status: "pilot" });
  await addMembership({ clinicId: a.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await addMembership({ clinicId: b.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await upsertFeeRule({ clinicId: a.id, doctorId: carlos.id, feeCents: 45000, clinicSharePercent: 30 });
  await upsertFeeRule({ clinicId: b.id, doctorId: carlos.id, feeCents: 30000, clinicSharePercent: 10 });
  const encA = await createEncounter({ clinicId: a.id, doctorId: carlos.id, patientKey: "teste.a@meurim.local", patientName: "Paciente A" });
  const encB = await createEncounter({ clinicId: b.id, doctorId: carlos.id, patientKey: "teste.b@meurim.local", patientName: "Paciente B" });
  await recordCheckIn({ clinicId: a.id, encounterId: encA.id, method: "pix", amountCents: 45000 });
  await recordCheckIn({ clinicId: b.id, encounterId: encB.id, method: "pix", amountCents: 30000 });

  const dropped = countsDropped(before, await collectIntegrityCounts());
  assert.equal(dropped.length, 0, dropped.join(", "));
  console.log("seed-staging-two-clinics ok", { a: a.id, b: b.id });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
