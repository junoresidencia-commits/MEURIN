import assert from "node:assert/strict";
import { patientKeyCandidates, patientKeysMatch } from "../src/lib/patient-keys";

const patient = { id: "abc-123", email: "Iolanda.Damacena@example.com" };
const fromPid = patientKeyCandidates("pid:abc-123", patient);
const fromEmail = patientKeyCandidates("iolanda.damacena@example.com", patient);

assert.ok(patientKeysMatch(fromPid, "pid:abc-123"));
assert.ok(patientKeysMatch(fromPid, "iolanda.damacena@example.com"));
assert.ok(patientKeysMatch(fromEmail, "pid:abc-123"));
assert.ok(patientKeysMatch(fromEmail, patient.email));
assert.ok(patientKeysMatch(fromPid, "ABC-123"));
assert.equal(patientKeysMatch(fromPid, "outra@example.com"), false);

console.log("patient-keys ok", { fromPid, fromEmail });
