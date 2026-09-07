import assert from "node:assert/strict";
import { extractClinicalFields, splitByConfidence } from "../src/lib/clinical-intelligence";
import { aFromRac, canConfirmDrc, gFromEgfr, refineG } from "../src/lib/kdigo";

function keys(text: string) {
  const d = extractClinicalFields(text);
  return Object.fromEntries(d.map((x) => [x.key, x.value]));
}

const sample =
  "Paciente 58 anos, motorista, HAS e DM2 há 15 anos. Ex-tabagista. DRC 3b. Cr 1,9, TFGe 38, RAC 720. EAS proteína 2+, hematúria negativa. Em uso de losartana 100 mg, dapagliflozina 10 mg e atorvastatina 40 mg. PA controlada. Retorno em 3 meses.";

const s = keys(sample);
assert.equal(s.has, "sim", "HAS");
assert.equal(s.dm, "sim", "DM2");
assert.equal(s.tempo_dm_anos, "15", "tempo DM");
assert.equal(s.estagio_g, "G3b", "DRC 3b + TFGe 38");
assert.equal(s.categoria_a, "A3", "RAC 720 → A3");
assert.equal(s.drc, "sim", "DRC confirmada");
assert.equal(s.ex_tabagista, "sim", "ex-tabagista");
assert.equal(s.profissao, "motorista", "profissão");
assert.equal(s.proteinuria_fita, "2+", "EAS proteína");
assert.equal(s.hematuria_fita, "negativo", "hematúria negativa");
assert.ok(String(s.medicamentos_em_uso).includes("losartana"), "losartana");
assert.ok(String(s.medicamentos_em_uso).includes("dapagliflozina"), "dapa");

const neg = keys("Nega HAS e DM.");
assert.equal(neg.has, "nao");
assert.equal(neg.dm, "nao");

const fam = keys("História familiar de HAS.");
assert.equal(fam.has, undefined, "familiar não cadastra HAS");

const sus = keys("Suspeita de LES.");
assert.ok(!sus.doenca_autoimune || sus.doenca_autoimune === undefined || extractClinicalFields("Suspeita de LES.").every((x) => x.key !== "doenca_autoimune" || x.status === "suspeito" || !x.autoApply));

assert.equal(gFromEgfr(53), "G3a");
assert.equal(gFromEgfr(37), "G3b");
assert.equal(gFromEgfr(28), "G4");
assert.equal(refineG("G3", 53), "G3a");
assert.equal(aFromRac(12), "A1");
assert.equal(aFromRac(85), "A2");
assert.equal(aFromRac(930), "A3");
assert.equal(canConfirmDrc({ mentionedDrc: false, g: "G2", a: "A1", chronicReducedEgfr: false }), false);
assert.equal(canConfirmDrc({ mentionedDrc: false, g: "G4", a: null, chronicReducedEgfr: false }), true);

const roman = keys("DRC IV. Cr 2,1, TFGe 28. RAC 650 mg/g.");
assert.equal(roman.estagio_g, "G4");
assert.equal(roman.categoria_a, "A3");

const pack = keys("Pedreiro, fumou 2 maços/dia por 20 anos, parou há 8 anos.");
assert.equal(pack.profissao, "pedreiro");
assert.equal(pack.ex_tabagista, "sim");
assert.equal(pack.carga_tabagica, "40");
assert.equal(pack.tabagismo_cessacao_anos, "8");

const { auto } = splitByConfidence(extractClinicalFields(sample));
assert.ok(auto.length >= 6, `auto apply ${auto.length}`);

console.log("clinical-intelligence fixtures ok", Object.keys(s).length, "fields on sample");
