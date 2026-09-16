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
      "O PDF se assina no Assinador gov.br (é lá que você envia o arquivo). O app VIDaaS lê o QR do gov.br. A página da Valid é só para emitir certificado — não recebe o PDF.",
    primary: true,
    handoff: "native-share",
    apiReady: false,
    deepLink: null,
    officialLinks: [
      { id: "gov-assinador", label: "Assinador gov.br (é aqui que vai o PDF)", href: SIGNATURE_LINKS.govAssinador },
      { id: "vidaas-ios", label: "App VIDaaS iPhone", href: SIGNATURE_LINKS.vidaasIos },
      { id: "vidaas-android", label: "App VIDaaS Android", href: SIGNATURE_LINKS.vidaasAndroid },
      { id: "validar-iti", label: "Validar assinatura", href: SIGNATURE_LINKS.validarIti },
      { id: "vidaas-info", label: "Ainda não tenho certificado (Valid)", href: SIGNATURE_LINKS.vidaasInfo },
    ],
    mobileHint:
      "1) Baixe este PDF. 2) Abra o Assinador gov.br — é lá que você envia o arquivo. 3) O gov.br pede o VIDaaS: leia o QR com o app. 4) Volte e anexe o PDF assinado aqui. A página da Valid é só para emitir certificado, não para assinar.",
    desktopHint:
      "1) Baixe este PDF. 2) Abra o Assinador gov.br e envie o arquivo. 3) Quando pedir o certificado, leia o QR com o app VIDaaS no celular. 4) Anexe o PDF assinado aqui. VIDaaS Connect (Adobe) é o caminho do computador; a loja da Valid não recebe o PDF.",
    honesty:
      "Assinar o PDF dentro do Meu Rim (sem baixar) exige contrato de API com a Valid. Enquanto isso não existir, o caminho correto é gerar → assinar no VIDaaS/gov.br → anexar o PDF assinado ao prontuário.",
  },
  {
    id: "cfm",
    label: "CFM Digital",
    shortLabel: "CFM Digital",
    headline: "Serviços digitais oficiais do CFM",
    description:
      "Portal oficial do CFM para receitas e laudos eletrônicos. Abra a Prescrição eletrônica (QR abaixo) ou assine o PDF do Meu Rim no Assinador gov.br com o certificado da AR-CFM. A Credencial Médica / e-CRM identifica o médico; não há API pública do CFM para assinar o arquivo gerado aqui.",
    primary: false,
    handoff: "official-portal",
    apiReady: false,
    deepLink: null,
    officialLinks: [
      { id: "cfm-prescricao", label: "Prescrição eletrônica (CFM)", href: SIGNATURE_LINKS.cfmPrescricao },
      { id: "cfm-cert", label: "Certificado digital (AR-CFM)", href: SIGNATURE_LINKS.cfmCertificado },
      { id: "cfm-portal", label: "Portal de serviços do CFM", href: SIGNATURE_LINKS.cfmPortalServicos },
      { id: "cfm-ecrm", label: "e-CRM / Credencial Médica", href: SIGNATURE_LINKS.cfmEcrm },
    ],
    mobileHint:
      "A Prescrição Eletrônica do CFM é o portal oficial para receitas/laudos eletrônicos. Este PDF do Meu Rim não entra sozinho lá — abra o portal, use os dados do paciente e, se assinar o arquivo daqui, devolva o PDF abaixo.",
    desktopHint:
      "Abra a Prescrição Eletrônica do CFM para emitir no sistema do Conselho. Para assinar o PDF gerado no Meu Rim com o certificado da AR-CFM, use o Assinador gov.br (QR + VIDaaS).",
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
