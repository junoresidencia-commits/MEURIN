import assert from "node:assert/strict";
import { classifyFromLabs, aFromRac, gFromEgfr, canConfirmDrc } from "../src/lib/kdigo";
import { ckdEpi2021, estimateEgfr } from "../src/lib/egfr";

const g3b = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 38, measuredAt: "2026-03-01" },
    { testKey: "rac", value: 720, measuredAt: "2026-03-01" },
  ],
});
assert.equal(g3b.estagio_g, "G3b");
assert.equal(g3b.categoria_a, "A3");
assert.equal(g3b.drc, "sim");
assert.equal(g3b.kdigo, "G3bA3");
assert.equal(g3b.tfgeSource, "lab");

const g1a1 = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 95, measuredAt: "2026-03-01" },
    { testKey: "rac", value: 12, measuredAt: "2026-03-01" },
  ],
});
assert.equal(g1a1.estagio_g, "G1");
assert.equal(g1a1.categoria_a, "A1");
assert.equal(g1a1.drc, "nao");
assert.equal(g1a1.kdigo, "G1A1");

const g2a1 = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 72, measuredAt: "2026-03-01" },
    { testKey: "rac", value: 18, measuredAt: "2026-03-01" },
  ],
});
assert.equal(g2a1.estagio_g, "G2");
assert.equal(g2a1.categoria_a, "A1");
assert.equal(g2a1.drc, null, "G2 A1 isolado não confirma DRC");

const aer = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 52, measuredAt: "2026-03-01" },
    { testKey: "albuminuria_24h", value: 85, measuredAt: "2026-03-01" },
  ],
});
assert.equal(aer.estagio_g, "G3a");
assert.equal(aer.categoria_a, "A2");
assert.equal(aer.drc, "sim");
assert.equal(aer.kdigo, "G3aA2");

const noFakeA = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 88, measuredAt: "2026-03-01" },
    { testKey: "microalbuminuria", value: 25, measuredAt: "2026-03-01" },
    { testKey: "proteinuria_24h", value: 400, measuredAt: "2026-03-01" },
  ],
});
assert.equal(noFakeA.categoria_a, null, "não inventa A a partir de mg/L nem proteína total");
assert.equal(noFakeA.estagio_g, "G2");

const computed = classifyFromLabs({
  labs: [{ testKey: "creatinina", value: 1.9, measuredAt: "2026-03-01" }],
  birthdate: "1968-01-15",
  sex: "masculino",
  computeTfge: (cr, at) => estimateEgfr(cr, "1968-01-15", "masculino", at),
});
assert.equal(computed.tfgeSource, "calculado");
assert.ok(computed.tfge != null && computed.tfge > 0);
assert.equal(computed.estagio_g, gFromEgfr(computed.tfge!));
assert.equal(computed.tfge, ckdEpi2021(1.9, 58, "male"));

const chronic = classifyFromLabs({
  labs: [
    { testKey: "tfge", value: 44, measuredAt: "2025-12-01" },
    { testKey: "tfge", value: 41, measuredAt: "2026-04-01" },
  ],
});
assert.equal(chronic.estagio_g, "G3b");
assert.equal(chronic.drc, "sim", "TFGe <60 em ≥90 dias confirma DRC");

assert.equal(aFromRac(29.9), "A1");
assert.equal(aFromRac(30), "A2");
assert.equal(aFromRac(300), "A2");
assert.equal(aFromRac(300.1), "A3");
assert.equal(canConfirmDrc({ mentionedDrc: false, g: "G1", a: "A1", chronicReducedEgfr: false }), false);

console.log("kdigo-classify ok");
