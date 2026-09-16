import { fetchPdfBlob } from "@/lib/doc-pdf-client";

export function isLikelyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Mac/i.test(ua);
}

export async function getPdfFile(opts: {
  blob?: Blob | null;
  href?: string | null;
  filename: string;
}): Promise<File> {
  let blob = opts.blob ?? null;
  if (!blob && opts.href) {
    const res = await fetch(opts.href, { credentials: "include" });
    blob = await fetchPdfBlob(res, "Não foi possível abrir o PDF. Tente novamente.");
  }
  if (!blob) throw new Error("PDF indisponível.");
  const pdf = blob.type.includes("pdf") ? blob : new Blob([blob], { type: "application/pdf" });
  return new File([pdf], opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`, {
    type: "application/pdf",
  });
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openPdfFile(file: File) {
  const url = URL.createObjectURL(file);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) triggerDownload(file);
  else window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type SharePdfResult = "shared" | "downloaded" | "opened" | "cancelled";

/** iPhone/PWA: compartilhamento nativo (o médico escolhe o VIDaaS na folha do sistema).
 *  Sem deep link oficial documentado, não inventamos URI scheme.
 *  Desktop: baixa ou abre o PDF. */
export async function shareOrDownloadPdf(opts: {
  blob?: Blob | null;
  href?: string | null;
  filename: string;
  title: string;
  text?: string;
  prefer?: "share" | "download" | "open";
}): Promise<SharePdfResult> {
  const file = await getPdfFile(opts);
  const prefer = opts.prefer ?? (isLikelyMobile() ? "share" : "download");
  const text = opts.text || opts.title;

  if (prefer === "share") {
    try {
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: opts.title, text });
        return "shared";
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: opts.title, text, url: window.location.href });
        return "shared";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
    }
    triggerDownload(file);
    return "downloaded";
  }

  if (prefer === "open") {
    openPdfFile(file);
    return "opened";
  }

  triggerDownload(file);
  return "downloaded";
}

export function whatsappUrl(text: string, phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  const withCountry = !digits ? "" : digits.length >= 12 ? digits : `55${digits}`;
  const base = withCountry ? `https://wa.me/${withCountry}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
