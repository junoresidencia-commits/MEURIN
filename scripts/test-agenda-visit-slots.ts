/**
 * Agenda publicada (consulta, retorno ou ambos) deve continuar visível
 * para o paciente marcar. Identidade do paciente casa e-mail e pid.
 */
import assert from "node:assert/strict";
import { generateAvailableSlots, slotsForVisit, slotMatchesVisit, zonedDateTimeToUtc } from "../src/lib/scheduling";
import { patientKeyCandidates, patientKeysMatch } from "../src/lib/patient-keys";
import { groupSlotsByDayAndPlace, slotPlaceLabel } from "../src/lib/scheduling-client";
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

const nineBahia = zonedDateTimeToUtc("2026-10-12", "09:00", "America/Bahia");
assert.equal(nineBahia.toISOString(), "2026-10-12T12:00:00.000Z");

const mae = { id: "loc-mae", name: "Clínica mãe", city: "Irecê", type: "clinica" as const, active: true };
const salute = { id: "loc-salute", name: "Clínica Salute", city: "Irecê", type: "clinica" as const, active: true };
const published = {
  id: "doc-irece",
  tz: "America/Bahia",
  consultationPriceCents: 45000,
  weeklyAvailability: [],
  blockedSlots: [],
  locations: [mae, salute],
  availabilityPeriods: [
    { id: "manha", dayOfWeek: 1, start: "09:00", end: "12:00", modality: "presencial", locationId: mae.id, durationMin: 30, intervalMin: 10, priceCents: 45000, visitKind: "ambos" },
    { id: "tarde", dayOfWeek: 1, start: "14:30", end: "16:00", modality: "presencial", locationId: salute.id, durationMin: 30, intervalMin: 10, priceCents: 45000, visitKind: "ambos" },
    { id: "online", dayOfWeek: 1, start: "16:30", end: "22:00", modality: "teleconsulta", durationMin: 30, intervalMin: 10, visitKind: "ambos" },
  ],
} as unknown as Doctor;

const week = generateAvailableSlots(published, { daysAhead: 14 });
assert.ok(week.some((s) => s.modality === "presencial" && String(s.locationName).includes("Clínica mãe")));
assert.ok(week.some((s) => s.modality === "presencial" && String(s.locationName).includes("Clínica Salute")));
assert.ok(week.some((s) => s.modality === "teleconsulta"));
const maeHours = week
  .filter((s) => s.locationId === mae.id)
  .map((s) => new Date(s.start).toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" }));
assert.ok(maeHours.includes("09:00"), `mãe deve ter 09:00, veio ${maeHours.slice(0, 5).join(",")}`);
assert.ok(maeHours.includes("11:00"));
const saluteHours = week
  .filter((s) => s.locationId === salute.id)
  .map((s) => new Date(s.start).toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" }));
assert.ok(saluteHours.includes("14:30"));
const teleHours = week
  .filter((s) => s.modality === "teleconsulta")
  .map((s) => new Date(s.start).toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" }));
assert.ok(teleHours.includes("16:30"));

const grouped = groupSlotsByDayAndPlace(week);
assert.ok(grouped.some((d) => d.places.some((p) => /Clínica mãe/.test(p.label)) && d.places.some((p) => /Teleconsulta/.test(p.label))));
assert.match(slotPlaceLabel({ modality: "presencial", locationName: "Clínica mãe — Irecê", locationCity: "Irecê" }), /Presencial · Clínica mãe/);
assert.equal(slotPlaceLabel({ modality: "teleconsulta" }), "Teleconsulta (online)");

const monday = grouped.find((d) => /segunda/i.test(d.day));
assert.ok(monday, "segunda-feira agrupada no fuso da Bahia");
assert.ok(monday.places.some((p) => /Clínica mãe/.test(p.label)));
assert.ok(monday.places.some((p) => /Clínica Salute/.test(p.label)));
assert.ok(monday.places.some((p) => /Teleconsulta/.test(p.label)));
const lateHour = "21:10";
const lateTele = week.find((s) => s.modality === "teleconsulta" && new Date(s.start).toLocaleTimeString("en-GB", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" }) === lateHour);
assert.ok(lateTele, `teleconsulta ${lateHour} Bahia existe`);
assert.ok(
  monday.places.some((p) => p.slots.some((s) => s.start === lateTele!.start)),
  `${lateHour} Bahia não vira terça em UTC`
);

const semLocal = generateAvailableSlots({ ...published, locations: [] } as unknown as Doctor, { daysAhead: 14 });
assert.ok(semLocal.length > 0);
assert.ok(semLocal.every((s) => s.modality === "teleconsulta"), "presencial sem local cadastrado não aparece");

console.log("agenda-visit-slots ok", { slots: generated.length, week: week.length, days: grouped.length });
