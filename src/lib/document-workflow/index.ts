export { DOCUMENT_REGISTRY, getDocumentDefinition, listActiveDocumentDefinitions, definitionForClinicalType } from "./registry";
export {
  WORKFLOW_STATE_LABEL,
  WORKFLOW_STATE_TONE,
  type DocumentWorkflowState,
  type EncounterWorkflow,
  type WorkflowItem,
  type ConsentRequirement,
} from "./types";
export { workflowStateFromRecord, isLockedState, canEditContent, canFinalizeDocument, canSignDocument, canReleaseDocument } from "./state";
export { DEFAULT_DOCUMENT_WORKFLOW_FLAGS, flagsFromEnv } from "./flags";
export { requiredDocumentsForConduct, protocolHasOfficialTer } from "./rules";
export {
  researchConsentRequirement,
  terConsentRequirement,
  careBlockingConsents,
  platformConsentCategory,
} from "./consent-rules";
export { getAvailableSignatureMethods, explainMissingIntegraIcpChannel, vidaasIntegraIcpReady } from "./signature";
