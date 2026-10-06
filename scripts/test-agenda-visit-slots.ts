/**
 * Agenda publicada (consulta, retorno ou ambos) deve continuar visível
 * para o paciente marcar. Identidade do paciente casa e-mail e pid.
 */
import assert from "node:assert/strict";
import { generateAvailableSlots, slotsForVisit, slotMatchesVisit } from "../src/lib/scheduling";
import { patientKeyCandidates, patientKeysMatch } from "../src/lib/patient-keys";
import type { Doctor } from "../src/lib/types";

const consulta = { visitKind: "consulta" as const };
const retorno = { visitKind: "retorno" as const };
const ambos = { visitKind: "ambos" as const };
const legado = {};

assert.equal(slotMatchesVisit(consulta, "consulta"), true);
assert.equal(slotMatchesVisit(consulta, "retorno"), false);
assert.equal(slotMatchesVisit(retorno, "retorno"), true);
assert.equal(slotMatchesVisit(ambos, "consulta"), true);
assert.equal(slotMatchesVisit(legado, "retorno"), true);

const mixed = [consulta, retorno, ambos];
assert.deepEqual(slotsForVisit(mixed, "consulta").map((s) => s.visitKind), ["consulta", "ambos"]);
assert.deepEqual(slotsForVisit(mixed, "retorno").map((s) => s.visitKind), ["retorno", "ambos"]);
assert.equal(slotsForVisit(mixed, "all").length, 3);

const soRetorno = [retorno, retorno];
assert.equal(slotsForVisit(soRetorno, "consulta").length, 2, "agenda só de retorno ainda aparece na consulta");
assert.equal(slotsForVisit(soRetorno, "retorno").length, 2);

const soConsulta = [consulta];
assert.equal(slotsForVisit(soConsulta, "retorno").length, 1, "agenda só de consulta ainda aparece no retorno");
assert.equal(slotsForVisit([], "retorno").length, 0);

const keys = patientKeyCandidates("pid:abc-1", { id: "abc-1", email: "maria@meurim.com" });
assert.ok(patientKeysMatch(keys, "pid:abc-1"));
assert.ok(patientKeysMatch(keys, "abc-1"));
assert.ok(patientKeysMatch(keys, "maria@meurim.com"));
assert.ok(patientKeysMatch(patientKeyCandidates("abc-1"), "pid:abc-1"));
assert.ok(patientKeysMatch(patientKeyCandidates("pid:abc-1"), "abc-1"));
assert.equal(patientKeysMatch(keys, "outra@meurim.com"), false);
assert.equal(patientKeysMatch(keys, ""), false);

const doctor = {
  id: "doc-agenda",
  consultationPriceCents: 25000,
  weeklyAvailability: [],
  blockedSlots: [],
  locations: [],
  availabilityPeriods: [{
    id: "p1",
    dayOfWeek: new Date().getDay(),
    start: "11:00",
    end: "13:00",
    modality: "teleconsulta",
    durationMin: 40,
    intervalMin: 0,
    visitKind: "retorno",
  }],
} as unknown as Doctor;

const generated = generateAvailableSlots(doctor, { daysAhead: 8 });
assert.ok(generated.length > 0, "agenda de retorno gera horários");
assert.ok(generated.every((s) => s.visitKind === "retorno"));
assert.equal(slotsForVisit(generated, "consulta").length, generated.length, "consulta vê agenda só de retorno");
assert.equal(slotsForVisit(generated, "retorno").length, generated.length);

console.log("agenda-visit-slots ok", { slots: generated.length });
