import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import type { LetterheadArea } from "./letterheads-store";
import { winAnsiSafe } from "./pdf-text";

// A4 em pontos.
const A4_W = 595.28;
const A4_H = 841.89;
const INK = rgb(0.043, 0.184, 0.271); // ~ --text (#0b2f45)
const MUTED = rgb(0.35, 0.45, 0.52);
const LINE = rgb(0.75, 0.82, 0.85);

export interface DocPatient {
  name?: string;
  cpf?: string;
  birthdate?: string | null;
  idade?: string | number | null;
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
  date?: string; // ISO; default agora
  area: LetterheadArea;
  background?: DocBackground | null;
}

/** Substitui variáveis {{...}} pelos dados reais. */
export function fillFields(text: string, vars: Record<string, string>): string {
  return (text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key) => vars[String(key).toLowerCase()] ?? "");
}

function safe(text: string): string {
  return winAnsiSafe(text);
}

function widthOf(font: PDFFont, text: string, size: number): number {
  const t = safe(text);
  if (!t) return 0;
  try {
    return font.widthOfTextAtSize(t, size);
  } catch {
    return t.length * size * 0.5;
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
  const pushWord = (word: string, bold: boolean, spaceBefore: boolean) => {
    const f = bold ? fontBold : font;
    const clean = safe(word);
    const token = (spaceBefore ? " " : "") + clean;
    const w = widthOf(f, token, size);
    if (width + w > maxWidth && current.length > 0) {
      lines.push(current);
      current = [];
      width = 0;
      const w2 = widthOf(f, clean, size);
      current.push({ text: clean, bold });
      width += w2;
    } else {
      current.push({ text: token, bold });
      width += w;
    }
  };
  let first = true;
  for (const run of runs) {
    const words = run.text.split(/(\s+)/).filter((w) => w.length);
    for (const token of words) {
      if (/^\s+$/.test(token)) continue;
      pushWord(token, run.bold, !first);
      first = false;
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

export async function buildDocumentPdf(input: BuildDocInput): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // Prepara o fundo (papel timbrado).
  let bgImage: PDFImage | null = null;
  let bgPage: PDFEmbeddedPage | null = null;
  if (input.background) {
    try {
      if (input.background.kind === "image") {
        const bytes = input.background.bytes;
        const isPng = (input.background.mime || "").includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50);
        bgImage = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      } else {
        const [embedded] = await out.embedPdf(input.background.bytes as Uint8Array, [0]);
        bgPage = embedded ?? null;
      }
    } catch {
      bgImage = null;
      bgPage = null;
    }
  }

  const area = input.area;
  const x0 = A4_W * clamp01(area.marginLeft);
  const x1 = A4_W * (1 - clamp01(area.marginRight));
  const usableWidth = Math.max(120, x1 - x0);
  const yTop = A4_H * (1 - clamp01(area.marginTop));
  const yBottom = A4_H * clamp01(area.marginBottom);

  const drawBackground = (page: PDFPage, pageIndex: number) => {
    const wants =
      area.repeat === "all" ? true : area.repeat === "first" ? pageIndex === 0 : pageIndex === 0; // simplified: só a 1ª
    if (!wants) return;
    if (bgPage) {
      page.drawPage(bgPage, { x: 0, y: 0, width: A4_W, height: A4_H });
    } else if (bgImage) {
      // "contain": encaixa a imagem inteira sem deformar nem cortar.
      const scale = Math.min(A4_W / bgImage.width, A4_H / bgImage.height);
      const w = bgImage.width * scale;
      const h = bgImage.height * scale;
      page.drawImage(bgImage, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
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
      const t = safe(r.text);
      try {
        page.drawText(t, { x: cx, y: y - size, size, font: f, color: INK });
      } catch {
        /* caractere residual — segue o documento */
      }
      cx += widthOf(f, t, size);
    }
    y -= size * lineGap;
  };
  const drawParagraph = (text: string, size = 11) => {
    const runs = tokenizeBold(text);
    const wrapped = wrapRuns(runs, usableWidth, size, font, fontBold);
    if (wrapped.length === 0) { y -= size * 0.9; return; }
    for (const lineRuns of wrapped) drawLine(lineRuns, size);
  };
  const hr = () => {
    ensure(10);
    page.drawLine({ start: { x: x0, y: y - 4 }, end: { x: x1, y: y - 4 }, thickness: 0.8, color: LINE });
    y -= 14;
  };

  const date = input.date ? new Date(input.date) : new Date();
  const dateStr = date.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });

  // Cabeçalho do paciente
  if (area.showPatientHeader && input.patient) {
    const p = input.patient;
    const left = `Paciente: ${p.name || ""}`;
    const right = p.cpf ? `CPF: ${p.cpf}` : "";
    drawSplit(page, x0, x1, y, left, right, font, 10.5, INK, MUTED);
    y -= 15;
    const left2 = `Data: ${dateStr}`;
    const right2 = p.idade ? `Idade: ${p.idade} anos` : p.birthdate ? `Nasc.: ${new Date(p.birthdate).toLocaleDateString("pt-BR")}` : "";
    drawSplit(page, x0, x1, y, left2, right2, font, 10.5, INK, MUTED);
    y -= 16;
    hr();
    y -= 4;
  }

  // Título
  if (input.title) {
    ensure(20);
    try {
      page.drawText(safe(input.title), { x: x0, y: y - 15, size: 15, font: fontBold, color: INK });
    } catch { /* título com caractere residual */ }
    y -= 26;
  }

  // Conteúdo (parágrafos por linha; listas com "- ")
  const paragraphs = (input.content || "").split(/\r?\n/);
  for (const raw of paragraphs) {
    if (raw.trim() === "") { y -= 7; continue; }
    const bullet = /^\s*[-*]\s+/.test(raw);
    const text = bullet ? "\u2022  " + raw.replace(/^\s*[-*]\s+/, "") : raw;
    drawParagraph(text, 11);
    y -= 2;
  }

  // Assinatura (na página atual, reservando espaço)
  if (area.showSignature) {
    const need = 70;
    if (y - need < yBottom) newPage();
    const sigY = Math.max(yBottom + 46, yBottom + 46);
    const cx = (x0 + x1) / 2;
    page.drawLine({ start: { x: cx - 120, y: sigY + 16 }, end: { x: cx + 120, y: sigY + 16 }, thickness: 0.8, color: LINE });
    const dr = input.doctor;
    const cred = [dr.crm ? `${dr.crm}${dr.crmState ? "-" + dr.crmState : ""}` : "", dr.rqe ? `RQE ${dr.rqe}` : ""].filter(Boolean).join("  |  ");
    centerText(page, cx, sigY, safe(dr.name), fontBold, 11, INK);
    if (dr.specialty) centerText(page, cx, sigY - 13, safe(dr.specialty), font, 9.5, MUTED);
    if (cred) centerText(page, cx, sigY - 26, safe(cred), font, 9.5, MUTED);
  }

  return out.save();
}

function drawSplit(page: PDFPage, x0: number, x1: number, y: number, left: string, right: string, font: PDFFont, size: number, ink: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>) {
  try {
    page.drawText(safe(left), { x: x0, y: y - size, size, font, color: ink });
  } catch { /* ok */ }
  if (right) {
    const w = widthOf(font, safe(right), size);
    try {
      page.drawText(safe(right), { x: x1 - w, y: y - size, size, font, color: muted });
    } catch { /* ok */ }
  }
}
function centerText(page: PDFPage, cx: number, y: number, text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const t = safe(text);
  const w = widthOf(font, t, size);
  try {
    page.drawText(t, { x: cx - w / 2, y, size, font, color });
  } catch { /* ok */ }
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.45, Math.max(0, n));
}
