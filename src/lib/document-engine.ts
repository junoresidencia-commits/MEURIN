import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import type { LetterheadArea } from "./letterheads-store";
import { winAnsiSafe } from "./pdf-winansi";

// A4 em pontos.
const A4_W = 595.28;
const A4_H = 841.89;
const INK = rgb(0.043, 0.184, 0.271);
const MUTED = rgb(0.35, 0.45, 0.52);
const LINE = rgb(0.75, 0.82, 0.85);

/** Teto igual ao upload (12 MB). Não pulamos o timbrado “porque é um pouco grande”. */
export const LETTERHEAD_EMBED_MAX_BYTES = 12 * 1024 * 1024;
/** A4 ~180 dpi: escaneado enorme é reduzido, mas o fundo continua no PDF. */
const LETTERHEAD_MAX_PX = { w: 1488, h: 2104 };

export interface DocPatient {
  name?: string;
  cpf?: string;
  birthdate?: string | null;
  idade?: string | number | null;
  cid?: string | null;
  cns?: string | null;
}
export interface DocDoctor {
  name: string;
  crm?: string;
  crmState?: string;
  rqe?: string;
  specialty?: string;
}
export interface DocBackground {
  kind: "pdf" | "image";
  bytes: Buffer | Uint8Array;
  mime?: string | null;
}
export interface BuildDocInput {
  title?: string;
  content: string;
  patient?: DocPatient;
  doctor: DocDoctor;
  date?: string;
  area: LetterheadArea;
  background?: DocBackground | null;
  clinicName?: string | null;
  /** 1 = normal. 1.15 / 1.3 aumentam a letra sem cortar o texto. */
  fontScale?: number;
}

export type BuildDocResult = {
  bytes: Uint8Array;
  letterheadSkipped?: boolean;
};

/** Substitui variáveis {{...}} pelos dados reais. */
export function fillFields(text: string, vars: Record<string, string>): string {
  return (text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => vars[String(key).toLowerCase()] ?? "");
}

function asBytes(raw: Buffer | Uint8Array): Uint8Array {
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
}

function sniffBg(bytes: Uint8Array, declared?: string | null, mime?: string | null): "pdf" | "png" | "jpg" | "skip" {
  if (bytes.byteLength < 8) return "skip";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  const hint = `${declared || ""} ${mime || ""}`.toLowerCase();
  if (hint.includes("pdf")) return "pdf";
  if (hint.includes("png")) return "png";
  if (hint.includes("jpg") || hint.includes("jpeg")) return "jpg";
  return "skip";
}

function fontSafeChunk(font: PDFFont, chunk: string): string {
  if (!chunk) return "";
  try {
    font.encodeText(chunk);
    return chunk;
  } catch {
    let out = "";
    for (const ch of Array.from(chunk)) {
      try {
        font.encodeText(ch);
        out += ch;
      } catch {
        out += "?";
      }
    }
    return out;
  }
}

/** Helvetica/WinAnsi: tenta o texto; se um caractere sobrar, substitui em vez de derrubar o PDF.
 *  Não passa `\n` ao encode (WinAnsi rejeita) — as quebras de parágrafo precisam sobreviver. */
export function fontSafeText(font: PDFFont, text: string): string {
  const cleaned = winAnsiSafe(text);
  if (!cleaned) return "";
  if (!cleaned.includes("\n")) return fontSafeChunk(font, cleaned);
  return cleaned.split("\n").map((part) => fontSafeChunk(font, part)).join("\n");
}

function dateBr(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
  } catch {
    try {
      return d.toLocaleDateString("pt-BR");
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
}

type Run = { text: string; bold: boolean };
function tokenizeBold(line: string): Run[] {
  const parts = line.split("**");
  const runs: Run[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "") continue;
    runs.push({ text: parts[i], bold: i % 2 === 1 });
  }
  return runs.length ? runs : [{ text: line, bold: false }];
}

function wrapRuns(runs: Run[], maxWidth: number, size: number, font: PDFFont, fontBold: PDFFont): Run[][] {
  const lines: Run[][] = [];
  let current: Run[] = [];
  let width = 0;
  const pushToken = (token: string, bold: boolean) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(token || " ", size);
    if (width + w > maxWidth && current.length > 0) {
      lines.push(current);
      current = [];
      width = 0;
    }
    if (w > maxWidth) {
      let chunk = "";
      for (const ch of Array.from(token)) {
        const next = chunk + ch;
        if (f.widthOfTextAtSize(next || " ", size) > maxWidth && chunk) {
          current.push({ text: chunk, bold });
          lines.push(current);
          current = [];
          width = 0;
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      if (chunk) {
        current.push({ text: chunk, bold });
        width += f.widthOfTextAtSize(chunk, size);
      }
      return;
    }
    current.push({ text: token, bold });
    width += w;
  };
  const pushWord = (word: string, bold: boolean, spaceBefore: boolean) => {
    const f = bold ? fontBold : font;
    const token = fontSafeText(f, (spaceBefore ? " " : "") + word);
    pushToken(token || " ", bold);
    void f;
  };
  let first = true;
  for (const run of runs) {
    const words = fontSafeText(font, run.text).split(/(\s+)/).filter((w) => w.length);
    for (const token of words) {
      if (/^\s+$/.test(token)) continue;
      pushWord(token, run.bold, !first);
      first = false;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

async function shrinkLetterheadImage(
  bytes: Uint8Array,
  kind: "png" | "jpg",
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> {
  if (bytes.byteLength < 350 * 1024) return { bytes, kind };
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes, { failOn: "none" }).rotate().metadata();
    const tooManyPx =
      (meta.width || 0) > LETTERHEAD_MAX_PX.w || (meta.height || 0) > LETTERHEAD_MAX_PX.h;
    if (!tooManyPx && bytes.byteLength < 900 * 1024) return { bytes, kind };
    let pipeline = sharp(bytes, { failOn: "none" }).rotate();
    if (tooManyPx) {
      pipeline = pipeline.resize({
        width: LETTERHEAD_MAX_PX.w,
        height: LETTERHEAD_MAX_PX.h,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    if (kind === "png") {
      const out = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      return { bytes: new Uint8Array(out), kind: "png" };
    }
    const out = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(out), kind: "jpg" };
  } catch {
    return { bytes, kind };
  }
}

async function embedBackground(
  out: PDFDocument,
  background: DocBackground | null | undefined,
): Promise<{ bgImage: PDFImage | null; bgPage: PDFEmbeddedPage | null; skipped: boolean }> {
  const empty = { bgImage: null, bgPage: null, skipped: false };
  if (!background?.bytes) return empty;
  let bytes = asBytes(background.bytes);
  if (bytes.byteLength > LETTERHEAD_EMBED_MAX_BYTES) {
    return { bgImage: null, bgPage: null, skipped: true };
  }
  let kind = sniffBg(bytes, background.kind, background.mime);
  if (kind === "png" || kind === "jpg") {
    const shrunk = await shrinkLetterheadImage(bytes, kind);
    bytes = shrunk.bytes;
    kind = shrunk.kind;
  }
  try {
    if (kind === "png") {
      return { bgImage: await out.embedPng(bytes), bgPage: null, skipped: false };
    }
    if (kind === "jpg") {
      return { bgImage: await out.embedJpg(bytes), bgPage: null, skipped: false };
    }
    if (kind === "pdf") {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      if (src.getPageCount() < 1) return { ...empty, skipped: true };
      const [embedded] = await out.embedPdf(src, [0]);
      return { bgImage: null, bgPage: embedded ?? null, skipped: !embedded };
    }
  } catch {
    return { bgImage: null, bgPage: null, skipped: true };
  }
  return { ...empty, skipped: true };
}

async function renderOnce(input: BuildDocInput, useBackground: boolean): Promise<BuildDocResult> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);
  const safe = (t: string) => fontSafeText(font, t);

  const title = input.title ? safe(input.title) : input.title;
  const content = safe(input.content || "");
  const patient = input.patient
    ? {
        ...input.patient,
        name: input.patient.name ? safe(input.patient.name) : input.patient.name,
        cpf: input.patient.cpf ? safe(input.patient.cpf) : input.patient.cpf,
      }
    : input.patient;
  const doctor = {
    ...input.doctor,
    name: safe(input.doctor.name || ""),
    crm: input.doctor.crm ? safe(input.doctor.crm) : input.doctor.crm,
    crmState: input.doctor.crmState ? safe(input.doctor.crmState) : input.doctor.crmState,
    rqe: input.doctor.rqe ? safe(input.doctor.rqe) : input.doctor.rqe,
    specialty: input.doctor.specialty ? safe(input.doctor.specialty) : input.doctor.specialty,
  };

  let bgImage: PDFImage | null = null;
  let bgPage: PDFEmbeddedPage | null = null;
  let letterheadSkipped = false;
  if (useBackground && input.background) {
    const embedded = await embedBackground(out, input.background);
    bgImage = embedded.bgImage;
    bgPage = embedded.bgPage;
    letterheadSkipped = embedded.skipped || (!embedded.bgImage && !embedded.bgPage);
  }

  const area = input.area;
  const x0 = A4_W * clamp01(area.marginLeft);
  const x1 = A4_W * (1 - clamp01(area.marginRight));
  const usableWidth = Math.max(120, x1 - x0);
  const yTop = A4_H * (1 - clamp01(area.marginTop));
  const yBottom = A4_H * clamp01(area.marginBottom);

  const drawBackground = (page: PDFPage, pageIndex: number) => {
    const wants = area.repeat === "all" ? true : pageIndex === 0;
    if (!wants) return;
    try {
      if (bgPage) {
        page.drawPage(bgPage, { x: 0, y: 0, width: A4_W, height: A4_H });
      } else if (bgImage) {
        const scale = Math.min(A4_W / bgImage.width, A4_H / bgImage.height);
        const w = bgImage.width * scale;
        const h = bgImage.height * scale;
        page.drawImage(bgImage, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
      }
    } catch {
      bgPage = null;
      bgImage = null;
    }
  };

  let page = out.addPage([A4_W, A4_H]);
  let pageIndex = 0;
  drawBackground(page, pageIndex);
  let y = yTop;

  const newPage = () => {
    page = out.addPage([A4_W, A4_H]);
    pageIndex += 1;
    drawBackground(page, pageIndex);
    y = yTop;
  };
  const ensure = (needed: number) => {
    if (y - needed < yBottom) newPage();
  };

  const drawLine = (runs: Run[], size: number, lineGap = 1.35) => {
    ensure(size * lineGap);
    let cx = x0;
    for (const r of runs) {
      const f = r.bold ? fontBold : font;
      const t = fontSafeText(f, r.text);
      if (!t) continue;
      try {
        page.drawText(t, { x: cx, y: y - size, size, font: f, color: INK });
        cx += f.widthOfTextAtSize(t, size);
      } catch {
        /* caractere residual: pula o trecho, o PDF segue */
      }
    }
    y -= size * lineGap;
  };
  const drawParagraph = (text: string, size = 11) => {
    try {
      const runs = tokenizeBold(text);
      const wrapped = wrapRuns(runs, usableWidth, size, font, fontBold);
      if (wrapped.length === 0) {
        y -= size * 0.9;
        return;
      }
      for (const lineRuns of wrapped) drawLine(lineRuns, size);
    } catch {
      y -= size * 0.9;
    }
  };
  const hr = () => {
    ensure(10);
    page.drawLine({ start: { x: x0, y: y - 4 }, end: { x: x1, y: y - 4 }, thickness: 0.8, color: LINE });
    y -= 14;
  };

  const scale = Math.min(1.4, Math.max(1, Number(input.fontScale) || 1));
  const bodySize = 11 * scale;
  const titleSize = 15 * scale;
  const metaSize = 10.5 * scale;
  const dateStr = dateBr(input.date);
  const clinicName = input.clinicName ? safe(input.clinicName) : "";

  if (area.showPatientHeader && patient) {
    const headerBits = [
      `Paciente: ${patient.name || ""}`,
      patient.cpf ? `CPF: ${patient.cpf}` : "",
      patient.cns ? `CNS: ${patient.cns}` : "",
      patient.cid ? `CID-10: ${patient.cid}` : "",
      `Data: ${dateStr}`,
      patient.idade != null && String(patient.idade).trim() ? `Idade: ${patient.idade} anos` : "",
    ].filter(Boolean);
    if (!headerBits.some((b) => b.startsWith("Idade:")) && patient.birthdate) {
      try {
        headerBits.push(`Nasc.: ${new Date(patient.birthdate).toLocaleDateString("pt-BR")}`);
      } catch {
        /* sem nascimento */
      }
    }
    if (clinicName) headerBits.push(`Clínica: ${clinicName}`);
    for (const line of headerBits) drawParagraph(line, metaSize);
    hr();
    y -= 4;
  }

  if (title) {
    const heading = fontSafeText(fontBold, title);
    if (heading) {
      const wrapped = wrapRuns([{ text: heading, bold: true }], usableWidth, titleSize, font, fontBold);
      for (const lineRuns of wrapped) drawLine(lineRuns, titleSize, 1.25);
    }
    y -= 8;
  }

  const paragraphs = (content || "").split(/\r?\n/);
  for (const raw of paragraphs) {
    if (raw.trim() === "") {
      y -= 7 * scale;
      continue;
    }
    const bullet = /^\s*[-*]\s+/.test(raw);
    const text = bullet ? "-  " + raw.replace(/^\s*[-*]\s+/, "") : raw;
    drawParagraph(text, bodySize);
    y -= 2;
  }

  if (area.showSignature) {
    const need = 78 * scale;
    if (y - need < yBottom) newPage();
    const sigY = yBottom + 48;
    const cx = (x0 + x1) / 2;
    page.drawLine({ start: { x: cx - 120, y: sigY + 16 }, end: { x: cx + 120, y: sigY + 16 }, thickness: 0.8, color: LINE });
    const cred = [doctor.crm ? `${doctor.crm}${doctor.crmState ? "-" + doctor.crmState : ""}` : "", doctor.rqe ? `RQE ${doctor.rqe}` : ""]
      .filter(Boolean)
      .join("  |  ");
    centerText(page, cx, sigY, doctor.name, fontBold, 11 * scale, INK);
    let dy = 13 * scale;
    if (doctor.specialty) {
      centerText(page, cx, sigY - dy, doctor.specialty, font, 9.5 * scale, MUTED);
      dy += 13 * scale;
    }
    if (cred) {
      centerText(page, cx, sigY - dy, cred, font, 9.5 * scale, MUTED);
      dy += 13 * scale;
    }
    if (clinicName) centerText(page, cx, sigY - dy, clinicName, font, 9 * scale, MUTED);
  }

  return { bytes: await out.save(), letterheadSkipped };
}

/**
 * Gera o PDF clínico. Timbrado inválido/pesado NÃO impede o documento:
 * tenta de novo em papel branco.
 */
export async function buildDocumentPdf(input: BuildDocInput): Promise<Uint8Array> {
  const result = await buildDocumentPdfDetailed(input);
  return result.bytes;
}

export async function buildDocumentPdfDetailed(input: BuildDocInput): Promise<BuildDocResult> {
  try {
    return await renderOnce(input, true);
  } catch (err) {
    if (input.background) {
      console.warn("[document-engine] timbrado falhou; gerando em papel branco", err instanceof Error ? err.message : err);
      const retry = await renderOnce({ ...input, background: null }, false);
      return { ...retry, letterheadSkipped: true };
    }
    throw err;
  }
}

function drawSplit(
  page: PDFPage,
  x0: number,
  x1: number,
  y: number,
  left: string,
  right: string,
  font: PDFFont,
  size: number,
  ink: ReturnType<typeof rgb>,
  muted: ReturnType<typeof rgb>,
) {
  const l = fontSafeText(font, left);
  if (l) {
    try {
      page.drawText(l, { x: x0, y: y - size, size, font, color: ink });
    } catch { /* cabeçalho residual */ }
  }
  if (right) {
    const r = fontSafeText(font, right);
    if (!r) return;
    try {
      const w = font.widthOfTextAtSize(r, size);
      page.drawText(r, { x: x1 - w, y: y - size, size, font, color: muted });
    } catch { /* cabeçalho residual */ }
  }
}
function centerText(page: PDFPage, cx: number, y: number, text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const t = fontSafeText(font, text);
  if (!t) return;
  try {
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: cx - w / 2, y, size, font, color });
  } catch { /* assinatura residual */ }
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.45, Math.max(0, n));
}
