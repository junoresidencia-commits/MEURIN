import assert from "node:assert/strict";
import { composeFiscalAddress, parseAvailabilityPeriods } from "../src/lib/availability-periods";

const parsed = parseAvailabilityPeriods([
  { dayOfWeek: 1, start: "08:00", end: "12:00", modality: "teleconsulta", durationMin: 30, intervalMin: 10 },
  { dayOfWeek: 9, start: "08:00", end: "12:00", modality: "teleconsulta" },
  { dayOfWeek: 2, start: "bad", end: "12:00", modality: "teleconsulta" },
  { dayOfWeek: 3, start: "14:00", end: "18:00", modality: "presencial" },
]);
assert.equal(parsed.length, 1, "só período válido entra");
assert.equal(parsed[0].dayOfWeek, 1);
assert.equal(parsed[0].modality, "teleconsulta");
assert.equal(parsed[0].durationMin, 30);

const address = composeFiscalAddress({
  street: "Rua das Flores",
  number: "120",
  complement: "Sala 2",
  neighborhood: "Centro",
  city: "Irecê",
  state: "ba",
  zip: "44900000",
});
assert.ok(address && address.includes("Rua das Flores, 120"));
assert.ok(address.includes("Irecê - BA"));
assert.ok(address.includes("CEP 44900-000"));
assert.equal(composeFiscalAddress({ address: "Só a cidade" }), "Só a cidade");

console.log("attendant-agenda helpers ok");
