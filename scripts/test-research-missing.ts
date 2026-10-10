import assert from "node:assert/strict";
import {
  chartFixHref,
  chartTabForFix,
  chartWindowName,
  firstLabTestKey,
  parseFaltantesQuery,
  preferredFixTab,
  wantsChartEdit,
} from "../src/lib/research-missing";

assert.equal(preferredFixTab([{ fixTab: "perfil" }, { fixTab: "exames" }, { fixTab: "perfil" }]), "perfil");
assert.equal(preferredFixTab([{ fixTab: "exames" }, { fixTab: "exames" }, { fixTab: "perfil" }]), "exames");
assert.equal(preferredFixTab([{ fixTab: "cadastro" }, { fixTab: "perfil" }]), "cadastro");
assert.equal(chartTabForFix("cadastro"), "perfil");
assert.equal(chartTabForFix("exames"), "exames");

const href = chartFixHref("a@b.com", [
  { key: "has", label: "HAS", fixTab: "perfil" },
  { key: "lab_creatinina", label: "Creatinina", fixTab: "exames" },
]);
assert.match(href, /^\/medicos\/paciente\/a%40b\.com\?/);
assert.match(href, /tab=perfil/);
assert.match(href, /faltantes=has%2Clab_creatinina/);
assert.equal(href.includes("editar=1"), false);

const idade = chartFixHref("x", [{ key: "idade", fixTab: "cadastro" }, { key: "has", fixTab: "perfil" }]);
assert.match(idade, /tab=perfil/);
assert.match(idade, /editar=1/);
assert.match(idade, /faltantes=idade/);

assert.deepEqual(parseFaltantesQuery("?faltantes=has,dm,lab_tfge"), ["has", "dm", "lab_tfge"]);
assert.deepEqual(parseFaltantesQuery(""), []);
assert.equal(wantsChartEdit("?tab=perfil&editar=1"), true);
assert.equal(wantsChartEdit("?tab=perfil"), false);
assert.equal(firstLabTestKey(["has", "lab_creatinina"]), "creatinina");
assert.equal(firstLabTestKey(["has"]), null);
assert.equal(chartWindowName("joao@meurim.com"), "meurim-prontuario-joaomeurimcom");

console.log("research-missing ok");
