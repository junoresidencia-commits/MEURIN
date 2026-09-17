import assert from "node:assert/strict";
import { accessSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DOCUMENT_REGISTRY,
  definitionForClinicalType,
  getDocumentDefinition,
  listActiveDocumentDefinitions,
} from "../src/lib/document-workflow/registry";
import { CEAF_PROTOCOLS } from "../src/lib/ceaf-catalog";
import { officialDocPages } from "../src/lib/ceaf-documents";

const MUST_EXIST = [
  "receita",
  "exame",
  "relatorio",
  "lme",
  "ter",
  "formulario_oficial",
  "consentimento_teleconsulta",
  "privacidade_lgpd",
  "termos_uso",
  "pesquisa_cientifica",
  "assinatura_digital",
  "atestado",
  "encaminhamento",
  "laudo",
];

function routeToFile(route: string): string {
  const trimmed = route.replace(/^\//, "").replace(/\/$/, "");
  return path.join("src/app", trimmed, "route.ts");
}

function mustFile(rel: string) {
  const full = path.join(process.cwd(), rel);
  assert.ok(existsSync(full), `arquivo obrigatório ausente: ${rel}`);
  return full;
}

function sourceContains(rel: string, needle: string | RegExp) {
  const text = readFileSync(mustFile(rel), "utf8");
  if (typeof needle === "string") {
    assert.ok(text.includes(needle), `${rel} deveria conter: ${needle}`);
  } else {
    assert.match(text, needle, `${rel} deveria casar ${needle}`);
  }
}

function main() {
  const active = listActiveDocumentDefinitions();
  assert.ok(active.length >= MUST_EXIST.length, "registry encolheu demais");

  for (const id of MUST_EXIST) {
    const def = getDocumentDefinition(id);
    assert.ok(def, `tipo sumiu do DocumentRegistry: ${id}`);
    assert.equal(def.active, true, `${id} foi desativado silenciosamente`);
  }

  assert.equal(definitionForClinicalType("receita")?.id, "receita");
  assert.equal(definitionForClinicalType("ter")?.id, "ter");
  assert.equal(definitionForClinicalType("lme")?.official, true);

  const lme = getDocumentDefinition("lme")!;
  assert.equal(lme.official, true);
  assert.equal(lme.authority, "SESAB/BA");
  const ter = getDocumentDefinition("ter")!;
  assert.equal(ter.requiresPatientSignature, true);
  assert.ok(ter.allowedSignatureMethods.includes("DIGITAL"));
  assert.ok(ter.allowedSignatureMethods.includes("MANUAL"));

  const pesquisa = getDocumentDefinition("pesquisa_cientifica")!;
  assert.equal(pesquisa.category, "consentimento");

  for (const def of DOCUMENT_REGISTRY.filter((d) => d.active)) {
    assert.ok(def.integrityPaths.length > 0, `${def.id} sem integrityPaths`);
    for (const p of def.integrityPaths) {
      accessSync(path.join(process.cwd(), p));
    }
    for (const route of def.integrityRoutes) {
      accessSync(path.join(process.cwd(), routeToFile(route)));
    }
  }

  mustFile("src/components/LmeWizard.tsx");
  mustFile("src/components/OfficialCeafDocs.tsx");
  mustFile("src/components/ConsentGate.tsx");
  mustFile("src/components/SignDocumentFlow.tsx");
  mustFile("src/components/DocumentWorkflowPanel.tsx");
  mustFile("src/app/lme/[id]/page.tsx");
  mustFile("src/lib/lme-store.ts");
  mustFile("src/lib/consent.ts");
  mustFile("public/forms/lme-oficial.pdf");
  mustFile("public/forms/ceaf-sesab-nefrologia.pdf");
  mustFile("src/app/api/document-workflow/route.ts");
  mustFile("src/lib/document-workflow/service.ts");

  sourceContains("src/components/SignDocumentFlow.tsx", "Assinar digitalmente");
  sourceContains("src/components/SignDocumentFlow.tsx", "Baixar / imprimir para assinar manualmente");
  sourceContains("src/components/SignDocumentFlow.tsx", "Abrir CFM");
  sourceContains("src/components/SignDocumentFlow.tsx", "Baixar PDF sem marcar como assinado");
  sourceContains("src/components/OfficialCeafDocs.tsx", "SignDocumentPanel");
  sourceContains("src/app/lme/[id]/page.tsx", "SignDocumentPanel");
  sourceContains("src/app/medicos/paciente/[email]/page.tsx", "DocumentWorkflowPanel");
  sourceContains("src/app/medicos/paciente/[email]/page.tsx", "LmeWizard");
  sourceContains("src/lib/consent.ts", "Termo de Consentimento para Teleconsulta");
  sourceContains("src/lib/digital-signature/attach-signed.ts", 'signatureMethod: method');

  const epoTer = officialDocPages("anemia_drc_alfaepoetina", "ter");
  assert.ok(epoTer && epoTer.pages.length > 0, "TER da anemia/EPO sumiu do pacote SESAB");
  const dmoTer = officialDocPages("dmo_drc", "ter");
  assert.ok(dmoTer && dmoTer.pages.length > 0, "TER da DMO sumiu do pacote SESAB");
  assert.equal(officialDocPages("sindrome_nefrotica_adultos", "ter"), undefined);

  for (const p of CEAF_PROTOCOLS) {
    assert.ok(typeof p.requiresTer === "boolean", `${p.id} perdeu requiresTer`);
  }

  const ids = DOCUMENT_REGISTRY.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "ids duplicados no registry");

  console.log("document-registry-integrity ok", {
    active: active.length,
    must: MUST_EXIST.length,
  });
}

main();
