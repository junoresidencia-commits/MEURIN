import "server-only";
import { softenOcrText } from "./ocr-text";

export type LabFileKind = "pdf" | "image" | "text" | "unknown";

export type LabFileText = {
  text: string;
  kind: LabFileKind;
  ocr: boolean;
  note?: string;
};

const OCR_MS = 22_000;

function kindOf(name: string, mime: string): LabFileKind {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tif{1,2}|heic)$/i.test(n)) return "image";
  if (m.startsWith("text/") || n.endsWith(".txt")) return "text";
  return "unknown";
}

async function withTimeout<T>(job: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      job,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function extractPdfText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const result = await extractText(pdf, { mergePages: true });
  const text = result.text as string | string[];
  return Array.isArray(text) ? text.join("\n") : String(text || "");
}

async function recognizeBuffer(buf: Buffer, langs: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(langs, 1, {
    cachePath: "/tmp/tessdata",
    gzip: true,
    workerBlobURL: false,
    errorHandler: (err) => console.error("[ocr]", err),
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6" as import("tesseract.js").PSM,
      user_defined_dpi: "150",
    });
    const { data } = await worker.recognize(buf);
    return String(data.text || "");
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function extractImageText(buf: Buffer): Promise<string> {
  const run = async () => {
    try {
      return await recognizeBuffer(buf, "por");
    } catch (err) {
      console.error("[ocr] por falhou, tentando eng", err);
      return recognizeBuffer(buf, "eng");
    }
  };
  return withTimeout(run(), OCR_MS, "ocr-timeout");
}

/** Extrai texto do PDF digital ou OCR da foto. Vazio = não leu (não inventa exame). */
export async function extractLabFileText(file: {
  name: string;
  type: string;
  buffer: Buffer;
}): Promise<LabFileText> {
  const kind = kindOf(file.name, file.type);
  if (kind === "text") {
    return { text: softenOcrText(file.buffer.toString("utf8")), kind, ocr: false };
  }
  if (kind === "pdf") {
    try {
      const text = softenOcrText((await extractPdfText(file.buffer)).trim());
      if (text.length >= 8) return { text, kind, ocr: false };
      return {
        text: "",
        kind,
        ocr: false,
        note: "PDF sem texto selecionável (é foto?). Mande o print/JPG ou cole o laudo.",
      };
    } catch {
      return { text: "", kind, ocr: false, note: "Não deu para ler este PDF. Mande a foto ou cole o texto." };
    }
  }
  if (kind === "image") {
    try {
      const text = softenOcrText((await extractImageText(file.buffer)).trim());
      if (text.length >= 8) return { text, kind, ocr: true };
      return {
        text: "",
        kind,
        ocr: true,
        note: "A foto não rendeu texto. Tente outra mais nítida, sem corte, ou cole o laudo.",
      };
    } catch (err) {
      const timed = err instanceof Error && err.message === "ocr-timeout";
      return {
        text: "",
        kind,
        ocr: true,
        note: timed
          ? "A leitura da imagem demorou demais e foi interrompida. Tente uma foto menor/nítida ou cole o texto do laudo."
          : "Não deu para ler a foto agora. Cole o texto do laudo.",
      };
    }
  }
  return { text: "", kind, ocr: false, note: "Use PDF, foto (JPG/PNG) ou cole o texto." };
}
