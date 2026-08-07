import { NextResponse } from "next/server";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { parseLabsFromText } from "@/lib/lab-parser";
import { addUpload, uploadExamFile, storageAvailable } from "@/lib/uploads-store";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;

/** Extrai o texto de um PDF (quando ele tem texto embutido, não é escaneado). */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    out += strings + "\n";
  }
  await doc.cleanup();
  return out;
}

/** Usa um modelo de visão (compatível com OpenAI) para transcrever exames de uma imagem. */
async function transcribeImageWithAI(base64: string, mime: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const prompt =
    "Transcreva TODOS os resultados de exames laboratoriais desta imagem. " +
    "Responda apenas com uma linha por exame no formato 'Nome valor unidade' e, se houver, uma linha 'Data: dd/mm/aaaa'. " +
    "Não explique nada, não invente valores.";
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";

  // Texto colado (laudo, WhatsApp etc.)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const text = String(body.text || "");
    if (!text.trim()) return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
    const parsed = parseLabsFromText(text);
    return NextResponse.json({ source: "texto", ...parsed });
  }

  // Arquivo: PDF ou imagem
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo PDF ou imagem." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 15 MB)." }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";

  // Guarda o arquivo original em Documentos/Exames do paciente (quando há storage).
  let storedOriginal = false;
  if (storageAvailable()) {
    try {
      const filePath = await uploadExamFile(access.key, {
        name: file.name || "exame",
        type: mime,
        buffer: Buffer.from(bytes),
      });
      await addUpload({
        patientEmail: access.key,
        uploader: "doctor",
        name: file.name || "exame",
        category: "exame importado",
        filePath,
        mime,
        sizeBytes: bytes.byteLength,
        examDate: null,
      });
      storedOriginal = true;
    } catch {
      /* segue mesmo sem salvar o original */
    }
  }

  let text = "";
  if (mime === "application/pdf") {
    try {
      text = await extractPdfText(bytes);
    } catch {
      text = "";
    }
  }

  // PDF escaneado (sem texto) ou imagem → tenta IA de visão.
  if (!text.trim()) {
    const base64 = Buffer.from(bytes).toString("base64");
    const aiText = await transcribeImageWithAI(base64, mime === "application/pdf" ? "image/png" : mime);
    if (aiText === null) {
      return NextResponse.json({
        source: mime.startsWith("image/") ? "imagem" : "pdf",
        labs: [],
        needsAI: true,
        storedOriginal,
        message:
          "Não foi possível ler o texto automaticamente. Para leitura de fotos e PDFs escaneados, configure a chave OPENAI_API_KEY em Secrets. Você também pode colar os resultados como texto.",
      });
    }
    text = aiText;
  }

  const parsed = parseLabsFromText(text);
  return NextResponse.json({
    source: mime.startsWith("image/") ? "imagem" : "pdf",
    storedOriginal,
    ...parsed,
  });
}
