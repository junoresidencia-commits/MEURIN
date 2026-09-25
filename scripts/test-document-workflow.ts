import assert from "node:assert/strict";
import {
  canEditContent,
  canFinalizeDocument,
  canReleaseDocument,
  canSignDocument,
  isLockedState,
  workflowStateFromRecord,
} from "../src/lib/document-workflow/state";
import { flagsFromEnv } from "../src/lib/document-workflow/flags";
import {
  careBlockingConsents,
  researchConsentRequirement,
  terConsentRequirement,
} from "../src/lib/document-workflow/consent-rules";
import { requiredDocumentsForConduct, protocolHasOfficialTer } from "../src/lib/document-workflow/rules";
import {
  getAvailableSignatureMethods,
  explainMissingIntegraIcpChannel,
} from "../src/lib/document-workflow/signature";
import { chartSignatureLabel, digitalSignatureLabel } from "../src/lib/digital-signature/status";
import { makeIdempotencyKey } from "../src/lib/document-workflow/idempotency";
import { DOCUMENT_AUDIT_EVENTS } from "../src/lib/document-workflow/audit-events";

function main() {
  assert.equal(workflowStateFromRecord({ status: "draft" }), "DRAFT");
  assert.equal(workflowStateFromRecord({ pdfPath: "x.pdf", status: "final" }), "READY_TO_SIGN");
  assert.equal(
    workflowStateFromRecord({ status: "signed", signatureMethod: "certificada" }),
    "VALIDATED",
  );
  assert.equal(
    workflowStateFromRecord({ status: "signed", signatureMethod: "certificada", sharedWithPatient: true }),
    "RELEASED",
  );
  assert.equal(
    workflowStateFromRecord({ status: "signed", signatureMethod: "imagem" }),
    "MANUALLY_SIGNED",
  );
  assert.equal(
    workflowStateFromRecord({ status: "final", pdfPath: "x.pdf", awaitingManual: true }),
    "AWAITING_MANUAL_SIGNATURE",
  );
  assert.equal(
    workflowStateFromRecord({ status: "signed", signatureMethod: "eletronica", pdfPath: "x.pdf" }),
    "READY_TO_SIGN",
  );

  assert.equal(canEditContent("VALIDATED"), false);
  assert.equal(canEditContent("MANUALLY_SIGNED"), false);
  assert.equal(canEditContent("READY_TO_SIGN"), true);
  assert.equal(isLockedState("VALIDATED"), true);
  assert.equal(isLockedState("DRAFT"), false);
  assert.equal(canSignDocument("READY_TO_SIGN"), true);
  assert.equal(canSignDocument("VALIDATED"), false);
  assert.equal(canFinalizeDocument("DRAFT"), true);
  assert.equal(canReleaseDocument("VALIDATED"), true);
  assert.equal(canReleaseDocument("READY_TO_SIGN"), false);

  assert.equal(digitalSignatureLabel({ status: "signed", signatureMethod: "certificada" }), "Assinado digitalmente");
  assert.equal(digitalSignatureLabel({ status: "signed", signatureMethod: "imagem" }), "Não assinado");
  assert.match(chartSignatureLabel({ status: "signed", signatureMethod: "imagem" }), /Assinado manualmente/);
  assert.match(chartSignatureLabel({ status: "signed", signatureMethod: "certificada" }), /Assinado digitalmente/);
  assert.match(chartSignatureLabel({ status: "final" }), /Aguardando assinatura/);

  const research = researchConsentRequirement({ accepted: false });
  assert.equal(research.requiredForCare, false);
  assert.equal(research.category, "pesquisa");
  const blocked = careBlockingConsents([
    research,
    { id: "x", category: "tratamento", label: "t", requiredForCare: true, accepted: false },
  ]);
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].id, "x");

  const ter = terConsentRequirement({ protocolId: "dmo_drc", signed: false });
  assert.equal(ter.accepted, false);
  assert.equal(ter.requiredForCare, false);

  assert.ok(protocolHasOfficialTer("anemia_drc_alfaepoetina"));
  assert.equal(protocolHasOfficialTer("sindrome_nefrotica_adultos"), false);

  const none = requiredDocumentsForConduct({ hasLme: false });
  assert.deepEqual(none, []);
  const epo = requiredDocumentsForConduct({ hasLme: true, protocolId: "anemia_drc_alfaepoetina" });
  assert.ok(epo.includes("lme"));
  assert.ok(epo.includes("ter"));
  assert.ok(epo.includes("receita"));
  assert.ok(epo.includes("relatorio"));
  const adultSn = requiredDocumentsForConduct({ hasLme: true, protocolId: "sindrome_nefrotica_adultos" });
  assert.ok(adultSn.includes("lme"));
  assert.equal(adultSn.includes("ter"), false);

  const flagsOff = flagsFromEnv({ DOCUMENT_WORKFLOW_ASSISTANT: "0" } as NodeJS.ProcessEnv);
  assert.equal(flagsOff.assistantEnabled, false);
  const noChannel = flagsFromEnv({
    VIDAAS_INTEGRAICP_ENABLED: "true",
  } as NodeJS.ProcessEnv);
  assert.equal(noChannel.vidaasIntegraIcpEnabled, false);
  const withChannel = flagsFromEnv({
    VIDAAS_INTEGRAICP_ENABLED: "1",
    VIDAAS_INTEGRAICP_CHANNEL: "official-channel",
  } as NodeJS.ProcessEnv);
  assert.equal(withChannel.vidaasIntegraIcpEnabled, true);

  const methods = getAvailableSignatureMethods();
  assert.equal(methods[0].id, "digital");
  assert.ok(methods.some((m) => m.id === "manual"));
  assert.ok(methods.some((m) => m.id === "cfm"));
  assert.match(explainMissingIntegraIcpChannel(), /Channel/);

  const a = makeIdempotencyKey({ documentId: "d1", doctorId: "doc", method: "DIGITAL", day: "2026-09-16" });
  const b = makeIdempotencyKey({ documentId: "d1", doctorId: "doc", method: "DIGITAL", day: "2026-09-16" });
  const c = makeIdempotencyKey({ documentId: "d1", doctorId: "doc", method: "MANUAL", day: "2026-09-16" });
  assert.equal(a, b);
  assert.notEqual(a, c);

  assert.ok(DOCUMENT_AUDIT_EVENTS.includes("CONSENT_ACCEPTED"));
  assert.ok(DOCUMENT_AUDIT_EVENTS.includes("MANUAL_SIGNED_DOCUMENT_UPLOADED"));
  assert.ok(DOCUMENT_AUDIT_EVENTS.includes("DIGITAL_SIGNATURE_COMPLETED"));

  console.log("document-workflow rules ok");
}

main();
