import type { DocumentWorkflowState } from "./types";

/** Mapeia o modelo já persistido (sem DROP/ALTER destrutivo) para a máquina de estados. */
export function workflowStateFromRecord(doc: {
  status?: string | null;
  signatureMethod?: string | null;
  sharedWithPatient?: boolean | null;
  pdfPath?: string | null;
  superseded?: boolean;
  awaitingManual?: boolean;
  signing?: boolean;
}): DocumentWorkflowState {
  if (doc.superseded) return "SUPERSEDED";
  if (doc.signing) return "SIGNING";
  if (doc.awaitingManual && doc.signatureMethod !== "imagem" && doc.signatureMethod !== "certificada") {
    return "AWAITING_MANUAL_SIGNATURE";
  }
  if (doc.status === "signed" && doc.signatureMethod === "certificada") {
    return doc.sharedWithPatient ? "RELEASED" : "VALIDATED";
  }
  if (doc.status === "signed" && doc.signatureMethod === "imagem") {
    return doc.sharedWithPatient ? "RELEASED" : "MANUALLY_SIGNED";
  }
  if (doc.status === "signed" && doc.signatureMethod === "eletronica") {
    return "READY_TO_SIGN";
  }
  if (doc.status === "draft") return "DRAFT";
  if (doc.pdfPath) return "READY_TO_SIGN";
  return "MISSING_DATA";
}

export function isLockedState(state: DocumentWorkflowState): boolean {
  return (
    state === "DIGITALLY_SIGNED" ||
    state === "VALIDATED" ||
    state === "RELEASED" ||
    state === "MANUALLY_SIGNED" ||
    state === "SUPERSEDED" ||
    state === "SIGNING"
  );
}

export function canEditContent(state: DocumentWorkflowState): boolean {
  return state === "DRAFT" || state === "MISSING_DATA" || state === "READY_TO_SIGN" || state === "AWAITING_CONSENT";
}

export function canFinalizeDocument(state: DocumentWorkflowState): boolean {
  return state === "READY_TO_SIGN" || state === "DRAFT" || state === "MISSING_DATA";
}

export function canSignDocument(state: DocumentWorkflowState): boolean {
  return state === "READY_TO_SIGN" || state === "AWAITING_MANUAL_SIGNATURE" || state === "SIGNING";
}

export function canReleaseDocument(state: DocumentWorkflowState): boolean {
  return state === "VALIDATED" || state === "DIGITALLY_SIGNED" || state === "MANUALLY_SIGNED" || state === "RELEASED";
}
