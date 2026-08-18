import "server-only";
import crypto from "crypto";

// Chave derivada de um segredo do servidor. Defina WHATSAPP_ENC_KEY (ou SESSION_SECRET)
// no ambiente. Nunca exponha segredos no frontend, logs ou código-fonte.
const KEY = crypto
  .createHash("sha256")
  .update(process.env.WHATSAPP_ENC_KEY || process.env.SESSION_SECRET || "meu-rim-dev-secret-change-me")
  .digest();

/** Criptografa um segredo (AES-256-GCM). Retorna string "v1:iv:tag:ct" (base64). */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Descriptografa um segredo gerado por encryptSecret. Uso EXCLUSIVO no backend. */
export function decryptSecret(enc: string | null | undefined): string {
  try {
    if (!enc || !enc.startsWith("v1:")) return "";
    const [, ivb, tagb, ctb] = enc.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivb, "base64"));
    decipher.setAuthTag(Buffer.from(tagb, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctb, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
