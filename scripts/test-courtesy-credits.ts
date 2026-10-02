import assert from "node:assert/strict";
import { courtesyKeysMatch, courtesyLabel, isCourtesyKind, normalizeCourtesyKey } from "../src/lib/courtesy";

assert.equal(isCourtesyKind("retorno"), true);
assert.equal(isCourtesyKind("gratis"), true);
assert.equal(isCourtesyKind("pix"), false);
assert.equal(courtesyLabel("retorno"), "Retorno grátis");
assert.equal(courtesyLabel("gratis"), "Consulta grátis");
assert.equal(normalizeCourtesyKey("  Joana@MeuRim.com "), "joana@meurim.com");

const credit = { patientKey: "5e5cf951-8d26-4c25-a7b6-2132fc2d53de", patientEmail: "joana@meurim.com" };
assert.equal(courtesyKeysMatch(credit, "JOANA@meurim.com"), true);
assert.equal(courtesyKeysMatch(credit, credit.patientKey), true);
assert.equal(courtesyKeysMatch(credit, "outra@pessoa.com"), false);
assert.equal(courtesyKeysMatch(credit, ""), false);

console.log("courtesy-credits ok");
