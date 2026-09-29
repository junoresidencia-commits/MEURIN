/** Só caminhos internos da API — evita abrir URL externa no iframe de impressão. */
export function safePdfSrc(raw: string): string {
  const src = String(raw || "").trim();
  if (!src.startsWith("/api/")) return "";
  if (src.includes("://") || src.startsWith("//")) return "";
  return src;
}

export function printHref(pdfUrl: string): string {
  const src = safePdfSrc(pdfUrl);
  if (!src) return "";
  return `/imprimir?src=${encodeURIComponent(src)}`;
}
