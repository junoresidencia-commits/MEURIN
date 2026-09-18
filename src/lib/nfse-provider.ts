/**
 * Integração NFS-e (Nota Fiscal de Serviço eletrônica).
 * Sem URL/token configurados o sistema NÃO inventa nota fiscal:
 * só entra na fila "Solicitar emissão".
 */

export type NfseIssueInput = {
  clinicId: string;
  clinicName: string;
  clinicCnpj?: string | null;
  amountCents: number;
  serviceLabel: string;
  patientName: string;
  patientCpf?: string | null;
  patientEmail?: string | null;
  patientAddress?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  issuedAt: string;
};

export type NfseIssueResult = {
  number: string;
  providerRef: string;
  pdf?: { name: string; type: string; buffer: Buffer };
  xml?: { name: string; type: string; buffer: Buffer };
};

export function nfseConfigured(): boolean {
  return Boolean(process.env.NFSE_PROVIDER_URL?.trim() && process.env.NFSE_PROVIDER_TOKEN?.trim());
}

export async function issueNfse(input: NfseIssueInput): Promise<NfseIssueResult> {
  void input;
  if (!nfseConfigured()) {
    throw new Error("Emissão automática de NFS-e ainda não configurada nesta clínica.");
  }
  throw new Error("Provedor de NFS-e configurado, mas a integração oficial ainda não foi ligada.");
}
