/**
 * Extração de TEXTO de PDF no navegador (client-only), usando pdf.js.
 * Reaproveita o worker já servido em /public/pdfjs. Retorna o texto concatenado
 * das páginas (preservando quebras por página) para alimentar o parser de exames.
 *
 * Observação: funciona com PDFs que possuem camada de texto (laudos gerados por
 * sistema). PDFs escaneados/foto (sem texto) retornam vazio — nesse caso o chamador
 * deve orientar o usuário (OCR de imagem é um passo separado).
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n");
}
