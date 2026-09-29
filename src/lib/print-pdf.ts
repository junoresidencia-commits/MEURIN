/** Só caminhos internos da API — evita abrir URL externa no iframe de impressão. */
export function safePdfSrc(raw: string): string {
  const src = String(raw || "").trim();
  if (!src.startsWith("/api/")) return "";
  if (src.includes("://")) return "";
  const pathOnly = src.split("?")[0];
  if (!pathOnly.startsWith("/api/") || pathOnly.includes("//")) return "";
  return src;
}

function withPrintFlag(src: string): string {
  if (!/\/oficial(\?|$)/.test(src)) return src;
  if (/[?&]print=/.test(src)) return src;
  return src + (src.includes("?") ? "&" : "?") + "print=1";
}

/** PDF achatado (já impresso) — Chrome mostra os valores como tinta no papel. */
export function flattenedSrc(pdfUrl: string): string {
  return withPrintFlag(safePdfSrc(pdfUrl));
}

export function printHref(pdfUrl: string): string {
  const src = flattenedSrc(pdfUrl);
  if (!src) return "";
  return `/imprimir?src=${encodeURIComponent(src)}`;
}
