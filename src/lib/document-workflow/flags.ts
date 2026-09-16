/** Flags do motor documental. Padrão: painel ligado; IntegraICP desligado até existir Channel oficial. */

export type DocumentWorkflowFlags = {
  /** Painel/assistente no prontuário. Não esconde LME/TER/compositor antigos. */
  assistantEnabled: boolean;
  /** Tentativa de API IntegraICP. Sem Channel permanece false. */
  vidaasIntegraIcpEnabled: boolean;
  /** Upload da via digitalizada após assinatura no papel. */
  manualSignatureUploadEnabled: boolean;
};

export const DEFAULT_DOCUMENT_WORKFLOW_FLAGS: DocumentWorkflowFlags = {
  assistantEnabled: true,
  vidaasIntegraIcpEnabled: false,
  manualSignatureUploadEnabled: true,
};

export function flagsFromEnv(env: NodeJS.ProcessEnv = process.env): DocumentWorkflowFlags {
  const off = (k: string) => env[k] === "0" || env[k] === "false";
  const on = (k: string) => env[k] === "1" || env[k] === "true";
  return {
    assistantEnabled: !off("DOCUMENT_WORKFLOW_ASSISTANT"),
    vidaasIntegraIcpEnabled: on("VIDAAS_INTEGRAICP_ENABLED") && Boolean(env.VIDAAS_INTEGRAICP_CHANNEL || env.VALID_INTEGRAICP_CHANNEL),
    manualSignatureUploadEnabled: !off("MANUAL_SIGNATURE_UPLOAD"),
  };
}

/** Limite do app VIDaaS externo (fornecedor; configurável). */
export function vidaasExternalMaxBytes(env: NodeJS.ProcessEnv = process.env): number {
  const mb = Number(env.VIDAAS_EXTERNAL_MAX_MB || 7);
  const safe = Number.isFinite(mb) && mb > 0 ? mb : 7;
  return Math.round(safe * 1024 * 1024);
}
