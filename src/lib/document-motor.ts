import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Letterhead, LetterheadFields } from "./letterheads-store";

/** A4 em pontos (pdf-lib). */
export const A4 = { width: 595.28, height: 841.89 };

export type MotorPatient = {
  name?: string;
  cpf?: string;
  age?: string;
  birthdate?: string;
};

export type MotorDoctor = {
  name: string;
  crm?: string;
  rqe?: string;
  specialty?: string;
};

export type MotorMedication = {
  name: string;
  presentation?: string;
  quantity?: string;
  posology?: string;
};

export type MotorInput = {
  title: string;
  body: string;
  medications?: MotorMedication[];
  patient: MotorPatient;
  doctor: MotorDoctor;
  date?: string; // ISO or dd/mm/yyyy
  letterhead?: Letterhead | null;
  signatureLabel?: string;
  /** Método visual de rubrica — NÃO é assinatura digital certificada. */
  signatureMethod?: "none" | "rubrica_texto" | "rubrica_imagem";
  signatureImageDataUrl?: string | null;
  qrPayload?: string | null;
};

function pct(n: number, total: number) {
  return (Math.max(0, Math.min(100, n)) / 100) * total;
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error("Arquivo do papel timbrado inválido.");
  const mime = m[1].toLowerCase();
  const bin = Buffer.from(m[2], "base64");
  return { mime, bytes: new Uint8Array(bin) };
}

function formatDate(d?: string): string {
  if (!d) return new Date().toLocaleDateString("pt-BR");
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  }
  return d;
}

function wrapText(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        // palavra maior que a linha
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            const t2 = chunk + ch;
            if (font.widthOfTextAtSize(t2, size) <= maxWidth) chunk = t2;
            else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function embedBackground(
  pdf: PDFDocument,
  letterhead: Letterhead
): Promise<{ pageWidth: number; pageHeight: number }> {
  const { mime, bytes } = parseDataUrl(letterhead.fileData);
  if (mime === "application/pdf") {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const [copied] = await pdf.copyPages(src, [0]);
    pdf.addPage(copied);
    const page = pdf.getPage(pdf.getPageCount() - 1);
    const { width, height } = page.getSize();
    return { pageWidth: width, pageHeight: height };
  }

  const page = pdf.addPage([A4.width, A4.height]);
  let img;
  if (mime.includes("png")) img = await pdf.embedPng(bytes);
  else img = await pdf.embedJpg(bytes);

  // Adequa ao A4 sem deformar (contain, centralizado).
  const scale = Math.min(A4.width / img.width, A4.height / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (A4.width - w) / 2;
  const y = (A4.height - h) / 2;
  page.drawImage(img, { x, y, width: w, height: h });
  return { pageWidth: A4.width, pageHeight: A4.height };
}

async function addBlankOrLetterheadPage(
  pdf: PDFDocument,
  letterhead: Letterhead | null | undefined,
  pageIndex: number
): Promise<{ pageWidth: number; pageHeight: number }> {
  if (!letterhead) {
    pdf.addPage([A4.width, A4.height]);
    return { pageWidth: A4.width, pageHeight: A4.height };
  }
  const mode = letterhead.pageMode || "all";
  if (pageIndex === 0 || mode === "all") {
    return embedBackground(pdf, letterhead);
  }
  if (mode === "first") {
    pdf.addPage([A4.width, A4.height]);
    return { pageWidth: A4.width, pageHeight: A4.height };
  }
  // simplified: fundo branco com margens maiores (sem recriar design)
  pdf.addPage([A4.width, A4.height]);
  return { pageWidth: A4.width, pageHeight: A4.height };
}

function drawField(
  page: ReturnType<PDFDocument["getPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  label: string,
  value: string,
  pos: { x: number; y: number; w?: number } | undefined,
  pageWidth: number,
  pageHeight: number,
  fallbackX: number,
  fallbackY: number
) {
  const x = pos ? pct(pos.x, pageWidth) : fallbackX;
  const yFromTop = pos ? pct(pos.y, pageHeight) : fallbackY;
  const y = pageHeight - yFromTop;
  const text = value ? `${label}${value}` : "";
  if (!text) return;
  page.drawText(text, {
    x,
    y: y - 10,
    size: 10,
    font,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: pos?.w ? pct(pos.w, pageWidth) : pageWidth * 0.4,
  });
}

/**
 * Motor universal: papel timbrado (PDF/imagem) + conteúdo médico → PDF final.
 * Não recria identidade visual do médico — usa o arquivo enviado como fundo.
 */
export async function generateMedicalPdf(input: MotorInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const letterhead = input.letterhead || null;
  const margins = {
    top: letterhead?.marginTop ?? 22,
    bottom: letterhead?.marginBottom ?? 18,
    left: letterhead?.marginLeft ?? 10,
    right: letterhead?.marginRight ?? 10,
  };
  const fields: LetterheadFields = letterhead?.fields || {};

  let { pageWidth, pageHeight } = await addBlankOrLetterheadPage(pdf, letterhead, 0);
  let page = pdf.getPage(0);

  const contentLeft = pct(margins.left, pageWidth);
  const contentRight = pageWidth - pct(margins.right, pageWidth);
  const contentTop = pageHeight - pct(margins.top, pageHeight);
  const contentBottom = pct(margins.bottom, pageHeight);
  const contentWidth = contentRight - contentLeft;

  // Campos de paciente (se posicionados; senão bloco no topo da área útil)
  const dateLabel = formatDate(input.date);
  if (fields.paciente || fields.cpf || fields.data || fields.idade) {
    drawField(page, font, "Paciente: ", input.patient.name || "", fields.paciente, pageWidth, pageHeight, contentLeft, pct(margins.top, pageHeight) + 4);
    drawField(page, font, "CPF: ", input.patient.cpf || "", fields.cpf, pageWidth, pageHeight, contentLeft + contentWidth * 0.55, pct(margins.top, pageHeight) + 4);
    drawField(page, font, "Data: ", dateLabel, fields.data, pageWidth, pageHeight, contentLeft, pct(margins.top, pageHeight) + 18);
    drawField(page, font, "Idade: ", input.patient.age || "", fields.idade, pageWidth, pageHeight, contentLeft + contentWidth * 0.55, pct(margins.top, pageHeight) + 18);
  } else if (!letterhead) {
    page.drawText(input.doctor.name, { x: contentLeft, y: contentTop - 14, size: 14, font: fontBold, color: rgb(0.05, 0.05, 0.05) });
    page.drawText([input.doctor.specialty, input.doctor.crm, input.doctor.rqe].filter(Boolean).join(" · "), {
      x: contentLeft,
      y: contentTop - 28,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(`Paciente: ${input.patient.name || "—"}`, { x: contentLeft, y: contentTop - 48, size: 10, font });
    page.drawText(`Data: ${dateLabel}`, { x: contentRight - 120, y: contentTop - 48, size: 10, font });
  } else {
    // Com timbrado sem campos: escreve identificação discreta no topo da área útil
    page.drawText(`Paciente: ${input.patient.name || "—"}  ·  Data: ${dateLabel}`, {
      x: contentLeft,
      y: contentTop - 12,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  }

  // Monta linhas do conteúdo
  const bodyParts: string[] = [];
  bodyParts.push(input.title.toUpperCase());
  bodyParts.push("");
  if (input.medications && input.medications.length > 0) {
    input.medications.forEach((med, i) => {
      bodyParts.push(`${i + 1}. ${med.name}${med.presentation ? ` — ${med.presentation}` : ""}`);
      if (med.quantity) bodyParts.push(`   Quantidade: ${med.quantity}`);
      if (med.posology) bodyParts.push(`   Posologia: ${med.posology}`);
      bodyParts.push("");
    });
  }
  if (input.body.trim()) {
    bodyParts.push(...input.body.split("\n"));
  }

  const allLines: { text: string; bold: boolean; size: number }[] = [];
  bodyParts.forEach((raw, idx) => {
    const isTitle = idx === 0;
    const bold = isTitle || /^\d+\.\s/.test(raw);
    const size = isTitle ? 13 : 11;
    const wrapped = wrapText(raw, bold ? fontBold : font, size, contentWidth);
    for (const t of wrapped) allLines.push({ text: t, bold, size });
  });

  let cursorY = contentTop - (fields.paciente || fields.data ? 40 : 28);
  let pageIndex = 0;

  const ensureSpace = async (needed: number) => {
    if (cursorY - needed >= contentBottom) return;
    pageIndex += 1;
    ({ pageWidth, pageHeight } = await addBlankOrLetterheadPage(pdf, letterhead, pageIndex));
    page = pdf.getPage(pdf.getPageCount() - 1);
    cursorY = pageHeight - pct(margins.top, pageHeight) - 16;
    if (letterhead?.pageMode === "simplified" || letterhead?.pageMode === "first") {
      page.drawText(`${input.title} (cont.)`, {
        x: contentLeft,
        y: cursorY,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      cursorY -= 18;
    }
  };

  for (const line of allLines) {
    const lineH = line.size + 5;
    await ensureSpace(lineH);
    if (line.text) {
      page.drawText(line.text, {
        x: contentLeft,
        y: cursorY - line.size,
        size: line.size,
        font: line.bold ? fontBold : font,
        color: rgb(0.08, 0.08, 0.08),
      });
    }
    cursorY -= lineH;
  }

  // Assinatura
  await ensureSpace(70);
  const sigPos = fields.assinatura;
  const sigX = sigPos ? pct(sigPos.x, pageWidth) : contentLeft + contentWidth * 0.45;
  const sigY = sigPos
    ? pageHeight - pct(sigPos.y, pageHeight)
    : Math.max(contentBottom + 50, cursorY - 40);

  const method = input.signatureMethod || "rubrica_texto";
  if (method !== "none") {
    page.drawLine({
      start: { x: sigX, y: sigY },
      end: { x: sigX + 180, y: sigY },
      thickness: 0.8,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(input.signatureLabel || input.doctor.name, {
      x: sigX,
      y: sigY - 14,
      size: 10,
      font: fontBold,
    });
    const cred = [input.doctor.crm, input.doctor.rqe].filter(Boolean).join(" · ");
    if (cred) {
      page.drawText(cred, { x: sigX, y: sigY - 26, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
    }
    page.drawText("Assinatura eletrônica (rubrica) — não é assinatura digital certificada", {
      x: sigX,
      y: sigY - 38,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  if (input.signatureImageDataUrl && method === "rubrica_imagem") {
    try {
      const { mime, bytes } = parseDataUrl(input.signatureImageDataUrl);
      const img = mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      page.drawImage(img, { x: sigX, y: sigY + 4, width: 120, height: 40 });
    } catch {
      /* ignore */
    }
  }

  // QR textual placeholder (validação futura)
  if (input.qrPayload && fields.qrcode) {
    const qx = pct(fields.qrcode.x, pageWidth);
    const qy = pageHeight - pct(fields.qrcode.y, pageHeight);
    page.drawText("Validação:", { x: qx, y: qy, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(input.qrPayload.slice(0, 40), { x: qx, y: qy - 10, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
  }

  return pdf.save();
}

export function pdfToDataUrl(bytes: Uint8Array): string {
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

export function fillPlaceholders(
  text: string,
  ctx: { patient: MotorPatient; doctor: MotorDoctor; date?: string }
): string {
  const map: Record<string, string> = {
    "{{paciente_nome}}": ctx.patient.name || "",
    "{{paciente_cpf}}": ctx.patient.cpf || "",
    "{{paciente_data_nascimento}}": ctx.patient.birthdate || "",
    "{{paciente_idade}}": ctx.patient.age || "",
    "{{data_atual}}": formatDate(ctx.date),
    "{{medico_nome}}": ctx.doctor.name || "",
    "{{medico_crm}}": ctx.doctor.crm || "",
    "{{medico_rqe}}": ctx.doctor.rqe || "",
    "{{medico_especialidade}}": ctx.doctor.specialty || "",
  };
  let out = text;
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out;
}
