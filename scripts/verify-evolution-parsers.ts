/**
 * Verificação rápida dos parsers da evolução (DRC, exames por data, medicações).
 * Uso: npx tsx scripts/verify-evolution-parsers.ts
 */
import { extractClinicalFields, formatDrcSummary } from "../src/lib/clinical-extractor";
import { parseLabGroups } from "../src/lib/lab-parser";
import { extractMedsFromText } from "../src/lib/med-parser";

type Case = { name: string; ok: boolean; detail?: string };
const cases: Case[] = [];

function field(text: string, key: string): string | undefined {
  return extractClinicalFields(text).find((f) => f.key === key)?.value;
}

function expectEq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  cases.push({ name, ok, detail: ok ? undefined : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}` });
}

expectEq("DRC 3 → G3 + sim", { g: field("Paciente com DRC 3, estável.", "estagio_g"), d: field("Paciente com DRC 3, estável.", "drc") }, { g: "G3", d: "sim" });
expectEq("Drc 3 1 2 → G3 (não pede 1/2/3/4)", field("Drc 3 1 2", "estagio_g"), "G3");
expectEq("DRC III romano", field("DRC III em tratamento conservador", "estagio_g"), "G3");
expectEq("DRC IV romano", field("DRC IV", "estagio_g"), "G4");
expectEq("DRC II", field("DRC II", "estagio_g"), "G2");
expectEq("DRC 3a", field("DRC 3a", "estagio_g"), "G3a");
expectEq("DRC G3b", field("DRC G3b", "estagio_g"), "G3b");
expectEq("estágio III", field("estágio III", "estagio_g"), "G3");
expectEq("DRC 3 A2", { g: field("DRC 3 A2", "estagio_g"), a: field("DRC 3 A2", "categoria_a") }, { g: "G3", a: "A2" });
expectEq("não casa DRC há 3 anos como estágio", field("DRC há 3 anos", "estagio_g"), undefined);
expectEq("summary DRC G3", formatDrcSummary(extractClinicalFields("DRC 3")), "DRC G3");

const twoDates = parseLabGroups(
  "10/01/2024 creatinina 1,4 potássio 4,2\nRetorno 20/03/2024\n15/02/2024 creatinina 1,6 ureia 58"
);
expectEq("duas datas de coleta", twoDates.map((g) => ({ date: g.date, keys: g.labs.map((l) => l.testKey) })), [
  { date: "2024-01-10", keys: ["creatinina", "potassio"] },
  { date: "2024-02-15", keys: ["creatinina", "ureia"] },
]);

const retorno = parseLabGroups("creatinina 2,1 em 05/06/2024. Retorno 20/07/2024.");
expectEq("ignora data de retorno", retorno.map((g) => g.date), ["2024-06-05"]);

const iso = parseLabGroups("2024-03-01 creatinina 1,2");
expectEq("data ISO", iso[0]?.date, "2024-03-01");

const meds = extractMedsFromText("Em uso:\nLosartana 50 mg 1x/dia\nFurosemida 40 mg");
expectEq("meds em uso", meds.map((m) => m.name), ["Losartana", "Furosemida"]);

const inlineMed = extractMedsFromText("Manter losartana 50 mg. Creatinina 1,3.");
expectEq("losartana com dose fora do bloco", inlineMed.map((m) => m.name), ["Losartana"]);

const twoMeds = extractMedsFromText("Manter losartana 50 mg 1x/dia e furosemida 40 mg.");
expectEq("dois meds na mesma linha", twoMeds.map((m) => m.name), ["Losartana", "Furosemida"]);

const failed = cases.filter((c) => !c.ok);
for (const c of cases) {
  console.log(`${c.ok ? "ok" : "FAIL"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
}
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${cases.length} casos ok`);
