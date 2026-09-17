/** Cliente: só inicia download/preview se a resposta for PDF de verdade. */

export const DOC_PDF_USER_ERROR =
  "Não foi possível gerar o documento. O texto continua na tela. Tente de novo.";

export function isPdfContentType(value: string | null) {
  return (value || "").toLowerCase().includes("application/pdf");
}

export async function readApiError(res: Response, fallback = DOC_PDF_USER_ERROR) {
  const type = res.headers.get("content-type") || "";
  if (type.includes("json")) {
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) return data.error;
    } catch {
      /* mensagem padrão */
    }
  }
  return fallback;
}

export async function fetchPdfBlob(res: Response, fallback = DOC_PDF_USER_ERROR) {
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !isPdfContentType(type)) {
    throw new Error(await readApiError(res, fallback));
  }
  const blob = await res.blob();
  if (blob.size < 80 || blob.type.includes("json")) {
    throw new Error(fallback);
  }
  return new Blob([blob], { type: "application/pdf" });
}
