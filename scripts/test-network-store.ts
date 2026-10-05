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
const { registerOrLinkPatient, attachPatientToProfessional } = await import("../src/lib/network-patients");
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

const novo = await registerOrLinkPatient(
  { kind: "doctor", id: "doc-a", name: "Dra. Ana", professionalName: "Dra. Ana", profession: "Médico(a)", specialty: "Nefrologia", photoUrl: null, notifyRole: "medico" },
  { name: "Bruno Lima Teste", cpf: "529.982.247-25", birthdate: "1990-01-15", sex: "masculino", address: "Irecê", phone: "77999001122" }
);
assert.equal(novo.linkedExisting, false);
assert.equal(novo.patient.doctorId, "doc-a");
const novoLink = await findProfessionalLink("doctor", "doc-a", novo.patient.email || `pid:${novo.patient.id}`);
assert.ok(novoLink);

const self = await createPatient({
  doctorId: "",
  name: "Paciente Agenda",
  email: "agenda.self@example.com",
  cpf: "11144477735",
});
assert.equal(self.doctorId, "");
const attached = await attachPatientToProfessional({
  kind: "doctor",
  professionalId: "doc-a",
  email: "agenda.self@example.com",
  origin: "booking",
});
assert.equal(attached?.doctorId, "doc-a");
const stillSame = await attachPatientToProfessional({
  kind: "doctor",
  professionalId: "doc-c",
  email: "agenda.self@example.com",
  origin: "return_request",
});
assert.equal(stillSame?.doctorId, "doc-a");
assert.ok(await findProfessionalLink("doctor", "doc-c", "agenda.self@example.com"));

const nutriSelf = await createPatient({ doctorId: "", name: "Lia Nutri", email: "lia.nutri@example.com" });
const nutriAttached = await attachPatientToProfessional({
  kind: "nutrition",
  professionalId: "nut-1",
  email: "lia.nutri@example.com",
  origin: "return_request",
});
assert.equal(nutriAttached?.doctorId, "");
assert.ok(await findProfessionalLink("nutrition", "nut-1", "lia.nutri@example.com"));

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
