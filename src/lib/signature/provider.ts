import "server-only";

/* ============================================================================
   Adaptador de ASSINATURA DIGITAL (ICP-Brasil / PAdES) — independente de fornecedor.
   Permite plugar BirdID, VIDaaS, SafeID ou outro provedor compatível sem reescrever
   o módulo. Enquanto não houver credenciais/adaptador, opera como "não configurado"
   e NUNCA gera assinatura falsa/simulada.

   Segredos SEMPRE via variáveis de ambiente/servidor — nunca no frontend/tabelas/logs.
   ============================================================================ */

export interface SignPdfInput {
  pdf: Uint8Array;
  doctorId: string;
  documentId: string;
  reason?: string;
}
export interface SignPdfResult {
  status: "signed" | "pending" | "failed";
  signedPdf?: Uint8Array;
  providerRef?: string;
  message?: string;
}

/** Contrato do provedor de assinatura qualificada. Implementações reais adicionadas depois. */
export interface SignatureProvider {
  readonly id: string;
  /** true somente quando há credenciais/adaptador reais configurados. */
  isConfigured(): boolean;
  /** URL de autorização do provedor (redirecionamento seguro), quando aplicável. */
  getAuthorizationUrl?(opts: { doctorId: string; returnUrl: string }): Promise<string>;
  connectCertificate?(opts: { doctorId: string; code?: string }): Promise<{ ok: boolean; message?: string }>;
  disconnectCertificate?(opts: { doctorId: string }): Promise<{ ok: boolean }>;
  signPdf?(input: SignPdfInput): Promise<SignPdfResult>;
  confirmSignature?(opts: { providerRef: string }): Promise<SignPdfResult>;
  checkSignatureStatus?(opts: { providerRef: string }): Promise<SignPdfResult>;
  validateCertificate?(opts: { doctorId: string }): Promise<{ valid: boolean; expiresAt?: string; issuer?: string; holder?: string }>;
  getAuditEvidence?(opts: { providerRef: string }): Promise<Record<string, unknown>>;
  cancelSignature?(opts: { providerRef: string }): Promise<{ ok: boolean }>;
}

/** Provedor "vazio": nada configurado. Não assina — apenas informa que aguarda provedor. */
class NoopProvider implements SignatureProvider {
  readonly id = "none";
  isConfigured(): boolean {
    return false;
  }
  async signPdf(): Promise<SignPdfResult> {
    return { status: "failed", message: "Integração ICP-Brasil aguardando configuração do provedor." };
  }
}

/**
 * Seleciona o provedor conforme a variável de ambiente ICP_SIGNATURE_PROVIDER.
 * Enquanto nenhum adaptador real for plugado (e as credenciais existirem), retorna
 * o NoopProvider — o sistema mostra "aguardando configuração do provedor".
 */
export function getSignatureProvider(): SignatureProvider {
  // Ao plugar um provedor real: instanciar aqui conforme process.env.ICP_SIGNATURE_PROVIDER
  // (ex.: "birdid" | "vidaas" | "safeid"), lendo credenciais de env (server-only).
  return new NoopProvider();
}

export interface SignatureProviderStatus {
  configured: boolean;
  providerId: string | null;
}
export function signatureProviderStatus(): SignatureProviderStatus {
  const provider = getSignatureProvider();
  return {
    configured: provider.isConfigured(),
    providerId: process.env.ICP_SIGNATURE_PROVIDER?.trim() || null,
  };
}
