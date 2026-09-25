import assert from "node:assert/strict";
import { buildCalcContext } from "../src/lib/calculators/context";
import { runAll, runTool } from "../src/lib/calculators/engine";
import { ckdEpiCrCys2021, kfre4var } from "../src/lib/calculators/renal";
import { findRenalDrug } from "../src/lib/calculators/meds";
import { ckdEpi2021 } from "../src/lib/egfr";

function ctx(partial: Parameters<typeof buildCalcContext>[0]) {
  return buildCalcContext(partial);
}

function main() {
  const cr = runTool(
    "ckd_epi_cr_2021",
    ctx({
      ageYears: 60,
      sex: "female",
      labs: [{ testKey: "creatinina", value: 1.8, unit: "mg/dL", measuredAt: "2026-09-01T12:00:00.000Z" }],
    })
  );
  assert.equal(cr.status, "ok");
  assert.match(cr.headline, /TFG:/);
  assert.equal(cr.outputs.categoria_g, "G3b");
  assert.equal(cr.outputs.tfge, ckdEpi2021(1.8, 60, "female"));

  const missingCr = runTool("ckd_epi_cr_2021", ctx({ ageYears: 60, sex: "female" }));
  assert.equal(missingCr.status, "missing");
  assert.match(missingCr.headline, /falta creatinina/i);

  const combo = ckdEpiCrCys2021(1.0, 1.0, 50, "male");
  assert.ok(combo > 50 && combo < 90);

  const ga = runTool(
    "kdigo_ga",
    ctx({
      ageYears: 60,
      sex: "female",
      labs: [
        { testKey: "creatinina", value: 1.8, unit: "mg/dL", measuredAt: "2026-09-01T12:00:00.000Z" },
        { testKey: "rac", value: 420, unit: "mg/g", measuredAt: "2026-09-01T12:00:00.000Z" },
      ],
    })
  );
  assert.equal(ga.status, "ok");
  assert.match(String(ga.outputs.ga), /G3b A3/);

  const gaNoAcr = runTool(
    "kdigo_ga",
    ctx({
      ageYears: 60,
      sex: "female",
      labs: [{ testKey: "creatinina", value: 1.8, unit: "mg/dL", measuredAt: "2026-09-01T12:00:00.000Z" }],
    })
  );
  assert.equal(gaNoAcr.status, "missing");
  assert.match(gaNoAcr.explanation, /falta ACR/i);
  assert.equal(gaNoAcr.outputs.a, null);

  const cg = runTool(
    "cockcroft_gault",
    ctx({
      ageYears: 50,
      sex: "male",
      profile: { peso_kg: 70 },
      labs: [{ testKey: "creatinina", value: 1, unit: "mg/dL", measuredAt: "2026-09-01T12:00:00.000Z" }],
    })
  );
  assert.equal(cg.status, "ok");
  assert.equal(cg.outputs.crcl, 87.5);
  assert.match(cg.headline, /Cockcroft-Gault/);
  assert.doesNotMatch(cg.headline, /CKD-EPI/);

  const krt = runTool(
    "kfre_4var",
    ctx({
      ageYears: 70,
      sex: "male",
      profile: { hemodialise: "sim" },
      labs: [
        { testKey: "creatinina", value: 5, measuredAt: "2026-09-01T12:00:00.000Z" },
        { testKey: "rac", value: 400, measuredAt: "2026-09-01T12:00:00.000Z" },
      ],
    })
  );
  assert.equal(krt.status, "not_applicable");
  assert.match(krt.explanation, /terapia renal substitutiva/);

  const kfreHigh = runTool(
    "kfre_4var",
    ctx({
      ageYears: 50,
      sex: "male",
      labs: [
        { testKey: "creatinina", value: 1.0, measuredAt: "2026-09-01T12:00:00.000Z" },
        { testKey: "rac", value: 40, measuredAt: "2026-09-01T12:00:00.000Z" },
      ],
    })
  );
  assert.equal(kfreHigh.status, "not_applicable");
  assert.match(kfreHigh.explanation, /TFGe < 60/);

  const kfreMiss = runTool(
    "kfre_4var",
    ctx({
      ageYears: 70,
      sex: "female",
      labs: [{ testKey: "creatinina", value: 2.4, measuredAt: "2026-09-01T12:00:00.000Z" }],
    })
  );
  assert.equal(kfreMiss.status, "missing");
  assert.match(kfreMiss.headline, /ACR/);

  const { y2, y5 } = kfre4var(70, false, 30, 300);
  assert.ok(y2 > 0 && y2 < 1);
  assert.ok(y5 > y2);

  const preventYoung = runTool("prevent", ctx({ ageYears: 25, sex: "female" }));
  assert.equal(preventYoung.status, "not_applicable");
  assert.match(preventYoung.headline, /não aplicável/i);

  const preventCvd = runTool("prevent", ctx({ ageYears: 55, sex: "male", profile: { dcv: "sim" } }));
  assert.equal(preventCvd.status, "not_applicable");

  const preventMiss = runTool("prevent", ctx({ ageYears: 55, sex: "male" }));
  assert.equal(preventMiss.status, "missing");
  assert.ok(preventMiss.missing.includes("HDL") || preventMiss.missing.some((m) => /HDL/i.test(m)));

  const urr = runTool("urr", ctx({ extra: { ureia_pre: 150, ureia_pos: 45 } }));
  assert.equal(urr.status, "ok");
  assert.equal(urr.outputs.urr, 70);

  const urrMiss = runTool("urr", ctx({}));
  assert.equal(urrMiss.status, "missing");

  const ag = runTool(
    "anion_gap",
    ctx({
      labs: [
        { testKey: "sodio", value: 140, measuredAt: "2026-09-01" },
        { testKey: "cloro", value: 104, measuredAt: "2026-09-01" },
        { testKey: "bicarbonato", value: 20, measuredAt: "2026-09-01" },
        { testKey: "albumina", value: 3, measuredAt: "2026-09-01" },
      ],
    })
  );
  assert.equal(ag.status, "ok");
  assert.equal(ag.outputs.anion_gap, 16);

  const cipro = findRenalDrug("Ciprofloxacino 500 mg");
  assert.ok(cipro);
  const dose = runTool(
    "renal_dose",
    ctx({
      ageYears: 70,
      sex: "male",
      profile: { peso_kg: 70 },
      labs: [{ testKey: "creatinina", value: 2.2, measuredAt: "2026-09-01" }],
    }),
    { farmaco: "Ciprofloxacino", dose_atual: "500 mg", freq_atual: "12/12h" }
  );
  assert.equal(dose.status, "ok");
  assert.match(dose.headline, /Revisar dose renal/);
  assert.match(dose.explanation, /médico decide/);
  assert.doesNotMatch(dose.headline, /suspender automaticamente/i);

  const cfs = runTool("cfs", ctx({ ageYears: 88, sex: "female", profile: { dm: "sim", has: "sim" } }));
  assert.equal(cfs.status, "needs_clinical");
  assert.match(cfs.headline, /ainda não avaliada/i);

  const cfsRec = runTool("cfs", ctx({ extra: { cfs_score: 6, cfs_by: "Dra. Ana", cfs_at: "2026-09-25" } }));
  assert.equal(cfsRec.status, "recorded");
  assert.equal(cfsRec.headline, "CFS: 6");

  const spict = runTool("spict", ctx({}));
  assert.equal(spict.status, "needs_clinical");
  assert.doesNotMatch(spict.headline, /é paliativo/i);
  assert.match(spict.explanation, /Não estima meses de vida/);

  const spictPos = runTool("spict", ctx({ extra: { spict_avaliado: true, spict_indicadores: true } }));
  assert.match(spictPos.headline, /cuidados de suporte/i);
  assert.doesNotMatch(spictPos.headline, /é paliativo/i);

  const necpal = runTool("necpal", ctx({ extra: { necpal_avaliado: true, necpal_surpresa_nao: true, necpal_indicadores: true } }));
  assert.match(necpal.headline, /Necessidade de avaliação/);
  assert.match(necpal.explanation, /Não usar para suspender tratamento, recusar diálise/);

  const stale = runTool(
    "ckd_epi_cr_2021",
    ctx({
      ageYears: 60,
      sex: "male",
      labs: [{ testKey: "creatinina", value: 1.5, measuredAt: "2026-01-01T12:00:00.000Z" }],
    })
  );
  assert.ok(stale.staleWarnings.some((w) => /creatinina utilizada tem/i.test(w)));

  const auto = runAll(
    ctx({
      ageYears: 72,
      sex: "female",
      profile: { peso_kg: 62, altura_cm: 158, medicamentos_em_uso: "Metformina 500 mg\nIbuprofeno 400 mg" },
      labs: [
        { testKey: "creatinina", value: 2.1, measuredAt: "2026-09-20T12:00:00.000Z" },
        { testKey: "rac", value: 350, measuredAt: "2026-09-20T12:00:00.000Z" },
      ],
    })
  );
  assert.ok(auto.counts.updated >= 4);
  assert.ok(auto.counts.needData >= 1);
  const geri = auto.results.find((r) => r.toolId === "geriatric_med_review")!;
  assert.equal(geri.status, "ok");
  assert.match(geri.headline, /alerta/i);
  const poly = auto.results.find((r) => r.toolId === "polypharmacy")!;
  assert.equal(poly.outputs.quantidade, 2);
  assert.match(poly.explanation, /Não significa retirar medicamentos/);

  const empty = runAll(ctx({}));
  assert.equal(empty.results.find((r) => r.toolId === "ckd_epi_cr_2021")?.status, "missing");
  assert.equal(empty.results.find((r) => r.toolId === "kfre_4var")?.status, "missing");
  assert.ok(empty.results.every((r) => r.status !== "ok" || r.toolId === "renal_dose"));

  console.log("ok calculadoras", auto.counts);
}

main();
