import { getProtocol } from "@/lib/ceaf-catalog";
import { officialDocPages } from "@/lib/ceaf-documents";

/**
 * Quais documentos o motor exige para a conduta atual.
 * Sem LME/CEAF: não inventa burocracia (receita solta continua no compositor).
 */
export function requiredDocumentsForConduct(opts: { protocolId?: string | null; hasLme: boolean }): string[] {
  if (!opts.hasLme) return [];
  const ids = ["lme", "receita", "relatorio"];
  const protocol = opts.protocolId ? getProtocol(opts.protocolId) : undefined;
  if (protocol?.requiresTer && officialDocPages(protocol.id, "ter")) ids.push("ter");
  if (protocol?.requiresAccessForm && officialDocPages(protocol.id, "form")) ids.push("formulario_oficial");
  return ids;
}

export function protocolHasOfficialTer(protocolId: string): boolean {
  return Boolean(officialDocPages(protocolId, "ter"));
}
