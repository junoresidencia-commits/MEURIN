import { SIGNATURE_LINKS } from "@/lib/signature-links";

/** Camada DigitalSignatureProvider — catálogo de provedores de assinatura digital.
 *
 *  Não inventa API, deep link ou assinatura dentro do Meu Rim.
 *  CFM e VIDaaS hoje: gerar o PDF, encaminhar ao ambiente oficial do fornecedor
 *  e receber de volta o PDF já assinado. Credenciais do certificado nunca passam
 *  pelo Meu Rim. Quando existir API/deep link oficial documentado, plugar aqui
 *  (apiReady / deepLink) sem refazer o restante do fluxo.
 */

export type DigitalSignatureProviderId = "cfm" | "vidaas";

export type DigitalSignatureHandoff = "native-share" | "download" | "official-portal";

export type DigitalSignatureOfficialLink = {
  id: string;
  label: string;
  href: string;
};

export interface DigitalSignatureProvider {
  readonly id: DigitalSignatureProviderId;
  readonly label: string;
  readonly shortLabel: string;
  readonly headline: string;
  readonly description: string;
  readonly primary: boolean;
  /** Como o Meu Rim entrega o PDF hoje. */
  readonly handoff: DigitalSignatureHandoff;
  /** true somente com API oficial documentada e credenciais de servidor. */
  readonly apiReady: boolean;
  /** Deep link oficial documentado para abrir o PDF no app. null = não existe. */
  readonly deepLink: string | null;
  readonly officialLinks: DigitalSignatureOfficialLink[];
  readonly mobileHint: string;
  readonly desktopHint: string;
  readonly honesty: string;
}

export const DIGITAL_SIGNATURE_PROVIDERS: readonly DigitalSignatureProvider[] = [
  {
    id: "vidaas",
    label: "VIDaaS",
    shortLabel: "VIDaaS",
    headline: "Assinatura ICP-Brasil em nuvem",
    description:
      "Caminho principal para assinar o PDF com certificado digital A3 em nuvem (Valid). O Meu Rim gera o arquivo; a assinatura acontece no app VIDaaS, no VIDaaS Connect ou no Assinador gov.br.",
    primary: true,
    handoff: "native-share",
    apiReady: false,
    deepLink: null,
    officialLinks: [
      { id: "vidaas-info", label: "VIDaaS / Connect", href: SIGNATURE_LINKS.vidaasInfo },
      { id: "vidaas-ios", label: "App iPhone", href: SIGNATURE_LINKS.vidaasIos },
      { id: "vidaas-android", label: "App Android", href: SIGNATURE_LINKS.vidaasAndroid },
      { id: "gov-assinador", label: "Assinador gov.br", href: SIGNATURE_LINKS.govAssinador },
      { id: "validar-iti", label: "Validar assinatura", href: SIGNATURE_LINKS.validarIti },
    ],
    mobileHint:
      "No iPhone: compartilhe o PDF e escolha o VIDaaS (ou Arquivos, e abra depois no app). No app: certificado → Assinar documentos → escolha o PDF (até 7 MB) → biometria. Não há deep link público documentado para abrir um PDF arbitrário.",
    desktopHint:
      "Baixe o PDF, instale o VIDaaS Connect na página oficial, leia o QR com o app e assine no Adobe (Assinar digitalmente). Ou envie o arquivo no Assinador gov.br — o VIDaaS autentica no celular.",
    honesty:
      "Assinar o PDF dentro do Meu Rim (sem baixar) exige contrato de API com a Valid. Enquanto isso não existir, o caminho correto é gerar → assinar no VIDaaS/gov.br → anexar o PDF assinado ao prontuário.",
  },
  {
    id: "cfm",
    label: "CFM Digital",
    shortLabel: "CFM Digital",
    headline: "Serviços digitais oficiais do CFM",
    description:
      "Acesso aos serviços digitais do Conselho Federal de Medicina. O certificado ICP-Brasil gratuito da AR-CFM é usado no VIDaaS. A Credencial Médica / e-CRM identifica o médico; não há API pública do CFM para assinar o PDF gerado no Meu Rim.",
    primary: false,
    handoff: "official-portal",
    apiReady: false,
    deepLink: null,
    officialLinks: [
      { id: "cfm-cert", label: "Certificado digital (AR-CFM)", href: SIGNATURE_LINKS.cfmCertificado },
      { id: "cfm-portal", label: "Portal de serviços do CFM", href: SIGNATURE_LINKS.cfmPortalServicos },
      { id: "cfm-prescricao", label: "Prescrição eletrônica", href: SIGNATURE_LINKS.cfmPrescricao },
      { id: "cfm-ecrm", label: "e-CRM / Credencial Médica", href: SIGNATURE_LINKS.cfmEcrm },
    ],
    mobileHint:
      "Abra o serviço oficial do CFM de que você precisa. Para assinar este PDF com o certificado emitido pelo CFM, compartilhe o arquivo e assine no VIDaaS — é o ambiente do certificado em nuvem da AR-CFM.",
    desktopHint:
      "Use os portais oficiais do CFM no computador. O certificado da AR-CFM assina PDFs pelo VIDaaS Connect / Assinador gov.br, não pelo aplicativo de credencial médica.",
    honesty:
      "Não fingimos que a Credencial Médica assina o PDF do Meu Rim. A Prescrição Eletrônica é o portal próprio do CFM. Este documento é gerado aqui; depois de assinado no ambiente do certificado, anexe o PDF de volta ao prontuário.",
  },
] as const;

const BY_ID = new Map(DIGITAL_SIGNATURE_PROVIDERS.map((p) => [p.id, p]));

export function getDigitalSignatureProvider(id: string): DigitalSignatureProvider | null {
  return BY_ID.get(id as DigitalSignatureProviderId) ?? null;
}

export function isDigitalSignatureProviderId(id: string): id is DigitalSignatureProviderId {
  return BY_ID.has(id as DigitalSignatureProviderId);
}

export function listDigitalSignatureProviders(): DigitalSignatureProvider[] {
  return [...DIGITAL_SIGNATURE_PROVIDERS].sort((a, b) => Number(b.primary) - Number(a.primary));
}
