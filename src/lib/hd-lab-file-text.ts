import "server-only";

export type LabFileKind = "pdf" | "image" | "text" | "unknown";

export type LabFileText = {
  text: string;
  kind: LabFileKind;
  ocr: boolean;
  note?: string;
};

function kindOf(name: string, mime: string): LabFileKind {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(n)) return "image";
  if (m.startsWith("text/") || n.endsWith(".txt")) return "text";
  return "unknown";
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const result = await extractText(pdf, { mergePages: true });
  return result.text;
}

async function extractImageText(buf: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const { data } = await worker.recognize(buf);
    return String(data.text || "");
  } finally {
    await worker.terminate();
  }
}

/** Extrai texto do PDF digital ou OCR da foto. Vazio = não leu (não inventa exame). */
export async function extractLabFileText(file: {
  name: string;
  type: string;
  buffer: Buffer;
}): Promise<LabFileText> {
  const kind = kindOf(file.name, file.type);
  if (kind === "text") {
    return { text: file.buffer.toString("utf8"), kind, ocr: false };
  }
  if (kind === "pdf") {
    try {
      const text = (await extractPdfText(file.buffer)).trim();
      if (text.length >= 8) return { text, kind, ocr: false };
      return {
        text: "",
        kind,
        ocr: false,
        note: "PDF sem texto selecionável (provavelmente só imagem). Tire um print ou mande a foto do laudo.",
      };
    } catch {
      return { text: "", kind, ocr: false, note: "Não deu para ler este PDF." };
    }
  }
  if (kind === "image") {
    try {
      const text = (await extractImageText(file.buffer)).trim();
      if (text.length >= 8) return { text, kind, ocr: true };
      return { text: "", kind, ocr: true, note: "A foto não rendeu texto. Tente outra foto, mais nítida, ou cole o laudo." };
    } catch {
      return { text: "", kind, ocr: true, note: "Não deu para ler a foto agora. Cole o texto do laudo." };
    }
  }
  return { text: "", kind, ocr: false, note: "Use PDF, foto (JPG/PNG) ou cole o texto." };
}
