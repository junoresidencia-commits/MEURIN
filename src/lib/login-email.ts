/** Normaliza e-mail de login: acento, espaço, Gmail sem ponto. */
export function normalizeLoginEmail(raw: string): string {
  const cleaned = String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  const at = cleaned.lastIndexOf("@");
  if (at <= 0) return cleaned;
  let local = cleaned.slice(0, at);
  const domain = cleaned.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

export function emailsMatch(a: string, b: string): boolean {
  const left = normalizeLoginEmail(a);
  const right = normalizeLoginEmail(b);
  return Boolean(left && right && left === right);
}
