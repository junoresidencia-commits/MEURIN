import assert from "node:assert/strict";
import { parseLabsFromText, parseLabGroups } from "../src/lib/lab-parser";
import { parsePtBrLabNumber } from "../src/lib/lab-number";
import { extractClinicalFields } from "../src/lib/clinical-intelligence";
import { labLabel } from "../src/lib/labs";

function byKey(text: string) {
  const { labs } = parseLabsFromText(text);
  return Object.fromEntries(labs.map((l) => [l.testKey, l]));
}

assert.equal(parsePtBrLabNumber("12.013", "mg"), 12013);
assert.equal(parsePtBrLabNumber("6.379", "mg"), 6379);
assert.equal(parsePtBrLabNumber("2.872", "mg"), 2872);
assert.equal(parsePtBrLabNumber("806,6"), 806.6);
assert.equal(parsePtBrLabNumber("1,2", "g"), 1.2);
assert.equal(parsePtBrLabNumber("12.013", "g"), 12.013);

assert.equal(labLabel("microalbuminuria"), "Albumina urinária");
assert.equal(labLabel("albuminuria_24h"), "Albuminúria 24h");

const real = byKey(`18/08/2026 — Proteinúria 24h: 12.013 mg/24h
13/08/2026 — RAC: 806,6 mg/g
18/08/2026 — Albuminúria 24h: 6.379 mg/24h`);
assert.equal(real.proteinuria_24h?.value, 12013, "proteinúria 12.013 mg/24h → 12013");
assert.equal(real.proteinuria_24h?.unit, "mg/24h");
assert.equal(real.rac?.value, 806.6, "RAC 806,6 mg/g");
assert.equal(real.rac?.unit, "mg/g");
assert.equal(real.albuminuria_24h?.value, 6379, "albuminúria 6.379 mg/24h → 6379");
assert.equal(real.albuminuria_24h?.unit, "mg/24h");

const later = byKey("31/08/2026 — Albuminúria 24h: 2.872 mg/24h");
assert.equal(later.albuminuria_24h?.value, 2872);

assert.equal(byKey("Proteinúria de 24 horas: 1,2 g/24h").proteinuria_24h?.value, 1200);
assert.equal(byKey("Proteína urinária de 24 horas: 850 mg/dia").proteinuria_24h?.value, 850);
assert.equal(byKey("Proteínas urinárias 24h: 0,3 g/dia").proteinuria_24h?.value, 300);
assert.equal(byKey("Proteínas – dosagem / amostra urina 24h: 12.013 mg/24h").proteinuria_24h?.value, 12013);
assert.equal(byKey("Proteína total urinária 24h: 500 mg/24 h").proteinuria_24h?.value, 500);

assert.equal(byKey("UACR 45 mcg/mg creatinina").rac?.value, 45);
assert.equal(byKey("ACR 30 mg/g").rac?.value, 30);
assert.equal(byKey("Relação albumina/creatinina: 120 mg/g").rac?.value, 120);
assert.equal(byKey("Relação albumina/creatinina urinária: 806,6").rac?.value, 806.6);
assert.equal(byKey("Microalbuminúria em mg/g de creatinina: 55").rac?.value, 55);
assert.equal(byKey("Microalbuminúria 50 mg/L").microalbuminuria?.value, 50);
assert.equal(byKey("Albumina urinária: 40 mg/L").microalbuminuria?.value, 40);
assert.equal(byKey("Microalbuminúria de 24 horas: 200 mg/24h").albuminuria_24h?.value, 200);
assert.equal(byKey("Albumina urinária 24h: 6.379 mg/24h").albuminuria_24h?.value, 6379);
assert.equal(byKey("Excreção urinária de albumina: 180 mg/dia").albuminuria_24h?.value, 180);

const serum = byKey("Albumina: 3,8 g/dL");
assert.equal(serum.albumina?.value, 3.8);
assert.equal(serum.microalbuminuria, undefined);
assert.equal(serum.albuminuria_24h, undefined);

const fita = byKey("EAS proteína 2+. Creatinina 1,9");
assert.equal(fita.proteinuria_24h, undefined);
assert.equal(fita.creatinina?.value, 1.9);

const four = byKey(`Albumina urinária 25 mg/L
RAC 806,6 mg/g
Albuminúria 24h 6379 mg/24h
Proteinúria 24h 12013 mg/24h`);
assert.equal(four.microalbuminuria?.value, 25);
assert.equal(four.rac?.value, 806.6);
assert.equal(four.albuminuria_24h?.value, 6379);
assert.equal(four.proteinuria_24h?.value, 12013);

const groups = parseLabGroups(`18/08/2026 — Proteinúria 24h: 12.013 mg/24h
13/08/2026 — RAC: 806,6 mg/g
18/08/2026 — Albuminúria 24h: 6.379 mg/24h
31/08/2026 — Albuminúria 24h: 2.872 mg/24h`);
const g18 = groups.find((g) => g.date === "2026-08-18");
const g13 = groups.find((g) => g.date === "2026-08-13");
const g31 = groups.find((g) => g.date === "2026-08-31");
assert.ok(g18?.labs.some((l) => l.testKey === "proteinuria_24h" && l.value === 12013));
assert.ok(g18?.labs.some((l) => l.testKey === "albuminuria_24h" && l.value === 6379));
assert.ok(g13?.labs.some((l) => l.testKey === "rac" && l.value === 806.6));
assert.ok(g31?.labs.some((l) => l.testKey === "albuminuria_24h" && l.value === 2872));

const concNotA = extractClinicalFields("Albumina urinária 25 mg/L. Creatinina 1,1.");
assert.ok(!concNotA.some((x) => x.key === "categoria_a"), "mg/L não classifica KDIGO A");
const racA = extractClinicalFields("RAC 806,6 mg/g");
assert.equal(racA.find((x) => x.key === "categoria_a")?.value, "A3");
const aerA = extractClinicalFields("Albuminúria 24h 6379 mg/24h");
assert.equal(aerA.find((x) => x.key === "categoria_a")?.value, "A3");

const stillWorks = byKey("CR: 3,51\nU: 94\nK: 5,8\nTFGE: 19\nPlaqueta: 375 mil");
assert.equal(stillWorks.creatinina?.value, 3.51);
assert.equal(stillWorks.ureia?.value, 94);
assert.equal(stillWorks.potassio?.value, 5.8);
assert.equal(stillWorks.tfge?.value, 19);
assert.equal(stillWorks.plaquetas?.value, 375000);

console.log("lab-urinary fixtures ok", Object.keys(four).length, "distinct urinary fields");
