import assert from "node:assert/strict";
import {
  inferProtocolId,
  inferRouteAndForm,
  officialConsentimentoSlot,
  officialTerSlot,
  packageMissingLabels,
  receitaFromLme,
  relatorioFromLme,
} from "../src/lib/complementary-docs";
import { buildClinicalSummary } from "../src/lib/clinical-summary";

function main() {
  const inj = inferRouteAndForm("Alfaepoetina 4.000 UI injetável", "frasco-ampola");
  assert.equal(inj.injectable, true);
  assert.equal(inj.oral, false);
  assert.match(inj.route || "", /injet/i);

  const oral = inferRouteAndForm("Sevelâmer 800 mg", "comprimido");
  assert.equal(oral.oral, true);
  assert.equal(oral.injectable, false);
  assert.equal(oral.route, "via oral");

  const rxInj = receitaFromLme({
    cid10: "N18.0",
    medications: [{ name: "Alfaepoetina 4.000 UI injetável", presentation: "frasco-ampola", monthlyQty: "12" }],
  });
  assert.match(rxInj.body, /Alfaepoetina/);
  assert.match(rxInj.body, /injet/);
  assert.doesNotMatch(rxInj.body, /1 comprimido/i);
  assert.doesNotMatch(rxInj.body, /Via: via oral/);
  assert.match(rxInj.body, /Dose: ____/);
  assert.match(rxInj.body, /Quantidade: 12/);

  const rxOral = receitaFromLme({
    medications: [{ name: "Sevelâmer 800 mg", presentation: "comprimido" }],
  });
  assert.match(rxOral.body, /via oral/);
  assert.doesNotMatch(rxOral.body, /1 comprimido — via oral — 1x ao dia/);

  const rel = relatorioFromLme({
    cid10: "N18.0",
    diagnosis: "Anemia na DRC",
    anamnesis: "HB 9,2",
    medications: [{ name: "Alfaepoetina 4.000 UI", presentation: "injetável" }],
  });
  assert.match(rel.body, /Anemia na DRC/);
  assert.match(rel.body, /Alfaepoetina/);

  assert.equal(inferProtocolId({ medications: [{ name: "Alfaepoetina 4.000 UI injetável", presentation: "frasco-ampola" }] }), "anemia_drc_alfaepoetina");
  assert.equal(inferProtocolId({ protocolId: "les", medications: [] }), "les");

  const ter = officialTerSlot("anemia_drc_alfaepoetina");
  assert.equal(ter.status, "available");
  const consent = officialConsentimentoSlot("anemia_drc_alfaepoetina");
  assert.equal(consent.status, "unavailable");
  assert.match(consent.reason || "", /TER/);

  const adult = officialTerSlot("sindrome_nefrotica_adultos");
  assert.equal(adult.status, "unavailable");

  const missing = packageMissingLabels([
    { kind: "receita", label: "Receita", status: "gerado" },
    { kind: "relatorio", label: "Relatório médico", status: "rascunho" },
    { kind: "ter", label: "TER", status: "nao_gerado" },
    { kind: "consentimento", label: "Consentimento", status: "indisponivel" },
  ]);
  assert.deepEqual(missing, ["Relatório médico", "TER"]);

  const summary = buildClinicalSummary({
    age: 58,
    data: { drc: "sim", estagio_g: "G5" },
    labs: [
      { testKey: "creatinina", value: 6.8, unit: "mg/dL", measuredAt: "2026-08-15T12:00:00.000-03:00" },
      { testKey: "creatinina", value: 7.2, unit: "mg/dL", measuredAt: "2026-09-20T12:00:00.000-03:00" },
      { testKey: "hemoglobina", value: 8.9, unit: "g/dL", measuredAt: "2026-09-20T12:00:00.000-03:00" },
    ],
  }).join(" ");
  assert.match(summary, /7,2/);
  assert.match(summary, /20\/09\/2026/);
  assert.doesNotMatch(summary, /6,8/);
  assert.match(summary, /8,9/);

  console.log("lme-complementary ok");
}

main();
