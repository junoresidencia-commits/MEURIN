import type { ConsentCategory, ConsentRequirement } from "./types";

/** Regras puras do ConsentEngine — sem I/O. Pesquisa NUNCA bloqueia assistência. */

export function researchConsentRequirement(opts: { accepted?: boolean }): ConsentRequirement {
  return {
    id: "pesquisa_cientifica",
    category: "pesquisa",
    label: "Pesquisa científica (opcional — recusar não impede o atendimento)",
    requiredForCare: false,
    accepted: Boolean(opts.accepted),
    href: "/plataforma/pesquisa",
  };
}

export function terConsentRequirement(opts: { protocolId?: string; signed?: boolean }): ConsentRequirement {
  return {
    id: opts.protocolId ? `ter:${opts.protocolId}` : "ter",
    category: "esclarecimento",
    label: "Termo de esclarecimento e responsabilidade (TER)",
    requiredForCare: false,
    accepted: Boolean(opts.signed),
    href: opts.protocolId ? `/api/ceaf/official?doc=ter&protocol=${encodeURIComponent(opts.protocolId)}` : undefined,
  };
}

export function platformConsentCategory(type: string): ConsentCategory {
  if (type === "telehealth") return "assistencial";
  if (type === "privacy") return "dados";
  return "dados";
}

/** Aceite de pesquisa recusado não entra em pendência assistencial. */
export function careBlockingConsents(consents: ConsentRequirement[]): ConsentRequirement[] {
  return consents.filter((c) => c.requiredForCare && !c.accepted && c.category !== "pesquisa" && c.category !== "contato_pesquisa");
}
