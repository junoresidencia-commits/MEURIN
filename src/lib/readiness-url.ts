/** Hosts de produção — staging precisa ser outro site. */
export const PRODUCTION_HOSTS = new Set([
  "meurim.vercel.app",
  "www.meurim.vercel.app",
  "meurin.vercel.app",
  "www.meurin.vercel.app",
]);

export function parseStagingUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const s = String(raw || "").trim();
  if (!s) return { ok: false, error: "Informe a URL do staging." };
  let u: URL;
  try {
    u = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, error: "Use http ou https." };
  }
  const host = u.hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(host)) {
    return { ok: false, error: "Essa é a URL de produção. Staging precisa ser outro site (ex.: meurin-stagin)." };
  }
  if (host === "localhost" || host === "127.0.0.1") {
    return { ok: false, error: "Localhost não é staging. Use o site da Vercel de teste." };
  }
  return { ok: true, url: u.origin };
}
