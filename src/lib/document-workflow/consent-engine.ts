import "server-only";
import { currentDocuments, type ConsentType } from "@/lib/consent";
import { listAcceptances } from "@/lib/consent-store";
import type { ConsentCategory, ConsentRequirement } from "./types";
import { platformConsentCategory } from "./consent-rules";

export { researchConsentRequirement, terConsentRequirement, careBlockingConsents } from "./consent-rules";

/** ConsentEngine — categorias separadas. Pesquisa NUNCA bloqueia assistência.
 *  O motor identifica o termo e a versão; NÃO aceita pelo paciente. */

export function consentCategoryForPlatform(type: ConsentType): ConsentCategory {
  return platformConsentCategory(type);
}

export async function getPlatformConsentRequirements(subjectKey: string): Promise<ConsentRequirement[]> {
  const docs = currentDocuments();
  const accepted = await listAcceptances(subjectKey).catch(() => []);
  return docs.map((d) => {
    const hit = accepted.find(
      (a) => a.consentType === d.type && a.consentVersion === d.version && a.accepted && !a.revoked,
    );
    return {
      id: `platform:${d.type}:${d.version}`,
      category: consentCategoryForPlatform(d.type),
      label: d.title,
      // Aceite de cadastro/agendamento — não vira parede no pacote documental do atendimento.
      requiredForCare: false,
      accepted: Boolean(hit),
      version: d.version,
      href: "/api/consent/documents",
    };
  });
}
