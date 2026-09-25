/** Status de assinatura digital ICP-Brasil no prontuário.
 *  A assinatura eletrônica interna do Meu Rim (login do médico) continua existindo
 *  e NÃO é apresentada como “Assinado digitalmente”. */

export const DIGITAL_SIGNED_LABEL = "Assinado digitalmente";
export const DIGITAL_UNSIGNED_LABEL = "Não assinado";

export type DigitalSignatureStatus = "signed" | "unsigned";

export function digitalSignatureStatus(doc: {
  status?: string | null;
  signatureMethod?: string | null;
}): DigitalSignatureStatus {
  if (doc.status === "signed" && doc.signatureMethod === "certificada") return "signed";
  return "unsigned";
}

export function digitalSignatureLabel(doc: {
  status?: string | null;
  signatureMethod?: string | null;
}): string {
  return digitalSignatureStatus(doc) === "signed" ? DIGITAL_SIGNED_LABEL : DIGITAL_UNSIGNED_LABEL;
}

/** Rótulo acessível do prontuário (digital ≠ manual ≠ pendente). */
export function chartSignatureLabel(doc: {
  status?: string | null;
  signatureMethod?: string | null;
}): string {
  if (doc.status === "signed" && doc.signatureMethod === "certificada") return "🟢 Assinado digitalmente";
  if (doc.status === "signed" && doc.signatureMethod === "imagem") return "🔵 Assinado manualmente";
  if (doc.status === "signed" && doc.signatureMethod === "eletronica") {
    return "🟡 Assinatura eletrônica (login) — não é ICP-Brasil";
  }
  return "🟡 Aguardando assinatura";
}
