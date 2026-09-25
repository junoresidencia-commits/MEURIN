import { SIGNATURE_LINKS } from "@/lib/signature-links";
import { flagsFromEnv, vidaasExternalMaxBytes } from "./flags";
import type { SignatureMethodKind, SignatureProviderId } from "./types";

/**
 * DigitalSignatureService — sem API inventada.
 *
 * IntegraICP (Valid): arquitetura pronta. Só liga signPdf interno quando
 * VIDAAS_INTEGRAICP_CHANNEL (Channel oficial) existir. Sem Channel, o fluxo
 * é EXTERNAL_DIGITAL_SIGNATURE: gerar PDF → Assinador gov.br / app VIDaaS →
 * anexar o PDF já assinado.
 *
 * CFM Prescrição Eletrônica é fluxo externo separado (não é segundo assinador de PDF).
 */

export type SignatureOption = {
  id: "digital" | "manual" | "cfm";
  label: string;
  primary: boolean;
  href?: string;
  method: SignatureMethodKind;
  provider: SignatureProviderId;
  detail: string;
};

export function getAvailableSignatureMethods(opts?: {
  allowed?: SignatureMethodKind[];
}): SignatureOption[] {
  const allowed = new Set(opts?.allowed || ["DIGITAL", "MANUAL", "EXTERNAL_OFFICIAL_FLOW"]);
  const flags = flagsFromEnv();
  const out: SignatureOption[] = [];
  if (allowed.has("DIGITAL")) {
    out.push({
      id: "digital",
      label: "Assinar digitalmente",
      primary: true,
      href: SIGNATURE_LINKS.govAssinador,
      method: "DIGITAL",
      provider: "vidaas",
      detail: flags.vidaasIntegraIcpEnabled
        ? "IntegraICP configurado — a autenticação ocorre no VIDaaS."
        : "Baixe o PDF, envie no Assinador gov.br e leia o QR com o app VIDaaS. Credencial IntegraICP (Channel) ainda não configurada.",
    });
  }
  if (allowed.has("MANUAL")) {
    out.push({
      id: "manual",
      label: "Baixar / imprimir para assinar manualmente",
      primary: false,
      method: "MANUAL",
      provider: "manual",
      detail: "Gera o PDF, congela a versão e aguarda a via digitalizada. Baixar não marca como assinado.",
    });
  }
  if (allowed.has("EXTERNAL_OFFICIAL_FLOW")) {
    out.push({
      id: "cfm",
      label: "Abrir CFM",
      primary: false,
      href: SIGNATURE_LINKS.cfmPrescricao,
      method: "EXTERNAL_OFFICIAL_FLOW",
      provider: "cfm",
      detail: "Abre a Prescrição eletrônica do CFM. Não há API pública para enviar este PDF automaticamente.",
    });
  }
  return out;
}

export function cfmPrescricaoExternalUrl(): string {
  return SIGNATURE_LINKS.cfmPrescricao;
}

export function vidaasSigningDestinationUrl(): string {
  return SIGNATURE_LINKS.govAssinador;
}

export function vidaasIntegraIcpReady(): boolean {
  return flagsFromEnv().vidaasIntegraIcpEnabled;
}

export function explainMissingIntegraIcpChannel(): string {
  return "Falta a credencial oficial Channel da IntegraICP (Valid). Sem ela o Meu Rim não chama API de assinatura; use o Assinador gov.br + VIDaaS e anexe o PDF.";
}

export function assertVidaasExternalSize(bytes: number): string | null {
  const max = vidaasExternalMaxBytes();
  if (bytes > max) {
    return `Este PDF tem ${(bytes / (1024 * 1024)).toFixed(1)} MB e passa do limite atual do app VIDaaS (~${Math.round(max / (1024 * 1024))} MB). Use o Assinador gov.br no computador ou reduza o arquivo.`;
  }
  return null;
}
