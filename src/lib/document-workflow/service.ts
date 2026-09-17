import "server-only";
import { getDocuments, type ClinicalDocument } from "@/lib/patient-store";
import { listLme, type LmeRequest } from "@/lib/lme-store";
import { getProtocol, inferCeafProtocols } from "@/lib/ceaf-catalog";
import { inferProtocolFromMedNames, officialDocPages } from "@/lib/ceaf-documents";
import { definitionForClinicalType, getDocumentDefinition } from "./registry";
import { workflowStateFromRecord } from "./state";
import {
  getPlatformConsentRequirements,
  researchConsentRequirement,
  terConsentRequirement,
} from "./consent-engine";
import { careBlockingConsents } from "./consent-rules";
import { listSessionsForPatient } from "./sessions";
import type { EncounterWorkflow, WorkflowItem, DocumentWorkflowState } from "./types";

function latestByType(docs: ClinicalDocument[], type: string): ClinicalDocument | undefined {
  return docs.filter((d) => d.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function inferProtocol(lme: LmeRequest | undefined): string | undefined {
  if (!lme) return undefined;
  return (
    inferProtocolFromMedNames((lme.medications || []).map((m) => m.name || "")) ||
    inferCeafProtocols({ cid10: lme.cid10, medications: lme.medications })[0]
  );
}

function item(partial: WorkflowItem): WorkflowItem {
  return partial;
}

function stateOfDoc(d: ClinicalDocument, awaitingManual: boolean): DocumentWorkflowState {
  return workflowStateFromRecord({
    status: d.status,
    signatureMethod: d.signatureMethod,
    sharedWithPatient: d.sharedWithPatient,
    pdfPath: d.pdfPath,
    awaitingManual,
  });
}

/**
 * DocumentWorkflowService — autoridade das pendências documentais do atendimento.
 * Não gera burocracia se o paciente não está em fluxo CEAF.
 */
export async function getEncounterWorkflow(opts: {
  patientKey: string;
  composerHref?: string;
}): Promise<EncounterWorkflow> {
  const patientKey = opts.patientKey;
  const [docs, lmes, sessions, platformConsents] = await Promise.all([
    getDocuments(patientKey),
    listLme(patientKey),
    listSessionsForPatient(patientKey).catch(() => []),
    getPlatformConsentRequirements(patientKey).catch(() => []),
  ]);

  const latestLme = lmes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const protocolId = inferProtocol(latestLme);
  const protocol = protocolId ? getProtocol(protocolId) : undefined;
  const awaiting = new Set(
    sessions.filter((s) => s.status === "awaiting_upload" || s.status === "started").map((s) => s.documentId || ""),
  );

  const items: WorkflowItem[] = [];

  const terDoc = docs.find(
    (d) => d.type === "ter" && (d.signatureMethod === "certificada" || d.signatureMethod === "imagem"),
  );

  if (latestLme) {
    const lmeSigned = Boolean(latestLme.signedAt) || docs.some((d) => d.type === "lme" && d.status === "signed");
    items.push(
      item({
        id: `lme:${latestLme.id}`,
        definitionId: "lme",
        label: "LME oficial",
        status: lmeSigned ? "ok" : "pending",
        state: lmeSigned ? "VALIDATED" : "READY_TO_SIGN",
        kind: lmeSigned ? "INFORMATION" : "REQUIRED_PENDING",
        href: `/lme/${latestLme.id}`,
        lmeId: latestLme.id,
        detail: protocol ? protocol.name : latestLme.cid10 || undefined,
      }),
    );
    if (protocol?.requiresTer && officialDocPages(protocol.id, "ter")) {
      const terSigned = Boolean(terDoc);
      items.push(
        item({
          id: `ter:${protocol.id}`,
          definitionId: "ter",
          label: "TER / termo de esclarecimento",
          status: terSigned ? "ok" : "pending",
          state: terSigned ? "VALIDATED" : "AWAITING_CONSENT",
          kind: terSigned ? "INFORMATION" : "REQUIRED_PENDING",
          href: `/lme/${latestLme.id}`,
          lmeId: latestLme.id,
          detail: "Páginas oficiais SESAB — preenche nome quando o arquivo tem campo.",
        }),
      );
    } else if (protocol?.requiresTer && !officialDocPages(protocol.id, "ter")) {
      items.push(
        item({
          id: `ter:${protocol.id}:unavailable`,
          definitionId: "ter",
          label: "TER específico deste protocolo",
          status: "warning",
          state: "MISSING_DATA",
          kind: "WARNING",
          href: `/lme/${latestLme.id}`,
          detail: "O pacote SESAB no Meu Rim não traz este TER. Não substituímos por outro protocolo.",
        }),
      );
    }
    if (protocol?.requiresAccessForm && officialDocPages(protocol.id, "form")) {
      items.push(
        item({
          id: `form:${protocol.id}`,
          definitionId: "formulario_oficial",
          label: "Formulário oficial de acesso",
          status: "ok",
          state: "READY_TO_SIGN",
          kind: "INFORMATION",
          href: `/lme/${latestLme.id}`,
        }),
      );
    }
  }

  const pushClinical = (type: string, label: string, required: boolean, href?: string) => {
    const d = latestByType(docs, type);
    const def = getDocumentDefinition(type) || definitionForClinicalType(type);
    if (!d && !required) return;
    if (!d) {
      items.push(
        item({
          id: `${type}:missing`,
          definitionId: def?.id || type,
          label,
          status: "pending",
          state: "NOT_STARTED",
          kind: required ? "REQUIRED_PENDING" : "WARNING",
          href: href || opts.composerHref,
        }),
      );
      return;
    }
    const st = stateOfDoc(d, awaiting.has(d.id));
    const signed = st === "VALIDATED" || st === "DIGITALLY_SIGNED" || st === "MANUALLY_SIGNED" || st === "RELEASED";
    items.push(
      item({
        id: d.id,
        definitionId: def?.id || type,
        label,
        status: signed ? "ok" : st === "AWAITING_MANUAL_SIGNATURE" ? "pending" : "pending",
        state: st,
        kind: signed ? "INFORMATION" : "REQUIRED_PENDING",
        href: d.pdfPath ? `/api/documents/${d.id}/pdf` : `/documento/${d.id}`,
        documentId: d.id,
      }),
    );
  };

  const ceafNeedsReceita = Boolean(latestLme);
  const ceafNeedsRelatorio = Boolean(latestLme);
  pushClinical("receita", "Receita", ceafNeedsReceita, opts.composerHref);
  pushClinical("exame", "Solicitação de exames", false, opts.composerHref);
  pushClinical("relatorio", "Relatório médico", ceafNeedsRelatorio, opts.composerHref);

  for (const d of docs) {
    if (["receita", "exame", "relatorio", "ter", "lme"].includes(d.type)) continue;
    const def = definitionForClinicalType(d.type);
    const st = stateOfDoc(d, awaiting.has(d.id));
    const signed = st === "VALIDATED" || st === "DIGITALLY_SIGNED" || st === "MANUALLY_SIGNED" || st === "RELEASED";
    items.push(
      item({
        id: d.id,
        definitionId: def?.id || d.type,
        label: d.title || def?.name || d.type,
        status: signed ? "ok" : "pending",
        state: st,
        kind: "INFORMATION",
        href: d.pdfPath ? `/api/documents/${d.id}/pdf` : `/documento/${d.id}`,
        documentId: d.id,
      }),
    );
  }

  const terSigned = Boolean(terDoc);
  const consents = [
    ...platformConsents,
    ...(protocol?.requiresTer ? [terConsentRequirement({ protocolId, signed: terSigned })] : []),
    researchConsentRequirement({ accepted: false }),
  ];

  const missing = items.filter((i) => i.kind === "REQUIRED_PENDING" || i.kind === "ERROR");
  const careConsentsMissing = careBlockingConsents(consents);
  const pendingCount = missing.length + careConsentsMissing.length;
  const canFinalizeEncounter = pendingCount === 0;

  let summary = "Documentação do atendimento em dia.";
  if (pendingCount === 1) summary = "1 pendência documental.";
  else if (pendingCount > 1) summary = `${pendingCount} pendências documentais.`;

  return {
    patientKey,
    items,
    consents,
    missing,
    canFinalizeEncounter,
    pendingCount,
    summary,
  };
}

