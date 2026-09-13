import assert from "node:assert/strict";
import { emailsMatch } from "../src/lib/login-email";
import { listDoctors } from "../src/lib/store";
import { listActiveRolesByActors, listMembershipsForActor } from "../src/lib/platform-store";
import { buildPlatformActor } from "../src/lib/platform-access";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const doctors = await listDoctors();
  const carlos = doctors.find((d) => emailsMatch(d.email, "carlos@meurim.com"));
  assert.ok(carlos, "Dr. Carlos no seed demo");

  const roles = await listActiveRolesByActors("doctor", doctors.map((d) => d.id));
  assert.ok(roles[carlos.id]);

  const memberships = await listMembershipsForActor("doctor", carlos.id);
  assert.ok(Array.isArray(memberships));

  const actor = await buildPlatformActor(carlos);
  assert.equal(actor.doctorId, carlos.id);
  assert.equal(actor.email, carlos.email);
  assert.ok(Array.isArray(actor.clinicAdmin));

  const again = await listDoctors();
  assert.equal(again.find((d) => d.id === carlos.id)?.passwordHash, carlos.passwordHash);

  console.log("platform-hotpath ok", { doctors: doctors.length, roles: actor.roles.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
