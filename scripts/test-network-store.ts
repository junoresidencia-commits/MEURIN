import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

async function main() {
const DATA = path.join(process.cwd(), "data");
await mkdir(DATA, { recursive: true });
await rm(path.join(DATA, "patients.json"), { force: true });
await rm(path.join(DATA, "network-referrals.json"), { force: true });

const { createNetworkReferral, updateNetworkReferral, listReferralsForProfessional, upsertProfessionalLink, findProfessionalLink } = await import("../src/lib/network-referrals-store");
const { findDuplicatePatient, createPatient } = await import("../src/lib/patients-store");
const { normalizePixKey } = await import("../src/lib/pix-key");

const a = await createPatient({
  doctorId: "doc-a",
  name: "Ana Clara Souza",
  cpf: "390.533.447-05",
  phone: "(77) 98888-1111",
  email: "ana.clara@example.com",
  birthdate: "1988-04-12",
  sex: "F",
  address: "Irecê",
});
const dupCpf = await findDuplicatePatient({ cpf: "39053344705", name: "Outra" });
assert.equal(dupCpf?.matchedBy, "cpf");
assert.equal(dupCpf?.patient.id, a.id);

const dupPhone = await findDuplicatePatient({ phone: "+55 77 98888-1111", name: "X" });
assert.equal(dupPhone?.matchedBy, "phone");

const dupMail = await findDuplicatePatient({ email: "ANA.CLARA@example.com" });
assert.equal(dupMail?.matchedBy, "email");

const dupBirth = await findDuplicatePatient({ birthdate: "1988-04-12", name: "Ana Clara Souza" });
assert.equal(dupBirth?.matchedBy, "birthdate");

const referral = await createNetworkReferral({
  patientKey: a.email!,
  patientName: a.name,
  registeredByKind: "doctor",
  registeredById: "doc-a",
  registeredByName: "Dra. Ana",
  fromKind: "doctor",
  fromId: "doc-a",
  fromName: "Dra. Origem",
  fromProfession: "Médico(a)",
  fromSpecialty: "Nefrologia",
  toKind: "doctor",
  toId: "doc-b",
  toName: "Dr. Destino",
  toProfession: "Médico(a)",
  toSpecialty: "Cardiologia",
  reason: "Avaliação cardiológica",
  notes: "PA resistente",
  status: "pending",
  shareSlices: ["reason", "clinicalSummary", "medications"],
  consentConfirmed: true,
  consentMethod: "in_person",
  consentAt: new Date().toISOString(),
  consentByKind: "doctor",
  consentById: "doc-a",
  consentByName: "Dra. Origem",
});
assert.equal(referral.status, "pending");
assert.equal(referral.consentConfirmed, true);

const lists = await listReferralsForProfessional("doctor", "doc-b");
assert.equal(lists.incoming.some((r) => r.id === referral.id), true);

const viewed = await updateNetworkReferral(
  referral.id,
  { status: "viewed" },
  { action: "viewed", actorKind: "doctor", actorId: "doc-b", actorName: "Dr. Destino" }
);
assert.equal(viewed?.status, "viewed");

await upsertProfessionalLink({
  patientKey: a.email!,
  patientName: a.name,
  professionalKind: "doctor",
  professionalId: "doc-b",
  origin: "referral",
  referralId: referral.id,
});
const link = await findProfessionalLink("doctor", "doc-b", a.email!);
assert.ok(link);

const pix = normalizePixKey("cpf", "390.533.447-05");
assert.equal(pix.ok, true);

await rm(path.join(DATA, "patients.json"), { force: true });
await rm(path.join(DATA, "network-referrals.json"), { force: true });

console.log("network-store ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
