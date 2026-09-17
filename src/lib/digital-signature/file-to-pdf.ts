import { PDFDocument } from "pdf-lib";

export async function fileToSignedPdfBuffer(file: File): Promise<{ buffer: Buffer; error?: string }> {
  const raw = Buffer.from(await file.arrayBuffer());
  const type = (file.type || "").toLowerCase();
  const name = file.name || "";
  if (type.includes("pdf") || /\.pdf$/i.test(name)) {
    return { buffer: raw };
  }
  if (type.includes("jpeg") || type.includes("jpg") || /\.jpe?g$/i.test(name)) {
    return { buffer: await embedImagePdf(raw, "jpg") };
  }
  if (type.includes("png") || /\.png$/i.test(name)) {
    return { buffer: await embedImagePdf(raw, "png") };
  }
  return { buffer: raw, error: "Envie um PDF da via assinada ou uma foto JPEG/PNG." };
}

async function embedImagePdf(bytes: Buffer, kind: "jpg" | "png"): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const img = kind === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
  const page = pdf.addPage([595.28, 841.89]);
  const maxW = 520;
  const maxH = 760;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
  return Buffer.from(await pdf.save());
}
