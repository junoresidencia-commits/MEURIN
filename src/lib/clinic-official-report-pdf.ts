import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { money, type OfficialClinicReport } from "@/lib/official-report";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const ink = rgb(0.07, 0.16, 0.22);
const muted = rgb(0.35, 0.42, 0.48);
const rule = rgb(0.78, 0.84, 0.86);
const teal = rgb(0.05, 0.45, 0.48);
const soft = rgb(0.94, 0.97, 0.97);

function pdfSafe(text: string) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, "-")
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(text: string, max: number) {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function officialClinicReportPdf(report: OfficialClinicReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  const ensure = (need: number) => {
    if (y - need < MARGIN + 36) newPage();
  };

  const text = (value: string, x: number, size: number, weight = font, color = ink) => {
    page.drawText(pdfSafe(value), { x, y, size, font: weight, color });
  };

  page.drawRectangle({
    x: 0,
    y: PAGE.height - 96,
    width: PAGE.width,
    height: 96,
    color: soft,
  });
  text("MEU RIM", MARGIN, 9, bold, teal);
  y = PAGE.height - 40;
  text(report.title.toUpperCase(), MARGIN, 13, bold);
  y -= 15;
  text(report.subtitle, MARGIN, 10, font, muted);
  y -= 13;
  text(`Destinatário: ${report.destination}`, MARGIN, 8, font, muted);

  y = PAGE.height - 116;
  text(`Documento ${report.documentId}`, MARGIN, 8, bold, teal);
  text(`Emitido em ${report.issuedAt}`, PAGE.width - MARGIN - 148, 8, font, muted);
  y -= 14;
  text(`Período de competência: ${report.periodLabel}`, MARGIN, 10, bold);
  y -= 18;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 1,
    color: teal,
  });
  y -= 18;

  text("1. IDENTIFICAÇÃO DA UNIDADE", MARGIN, 10, bold, teal);
  y -= 14;
  for (const item of [
    `Nome fantasia: ${report.clinic.name}`,
    `Razão social: ${report.clinic.legalName}`,
    `CNPJ: ${report.clinic.cnpj}`,
    `Município: ${report.clinic.city}`,
  ]) {
    text(item, MARGIN, 9);
    y -= 12;
  }

  y -= 6;
  text("2. RESUMO DA PRODUÇÃO", MARGIN, 10, bold, teal);
  y -= 16;
  const cards = [
    ["Atendimentos", String(report.totals.appointments)],
    ["Valor total", money(report.totals.billedCents)],
    ["Recebido", money(report.totals.receivedCents)],
    ["Pendente", money(report.totals.pendingCents)],
    ["Retenção clínica", money(report.totals.clinicCents)],
    ["Honorários", money(report.totals.doctorCents)],
  ];
  const cardW = (PAGE.width - MARGIN * 2 - 10) / 3;
  cards.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = MARGIN + col * (cardW + 5);
    const top = y - row * 40;
    page.drawRectangle({
      x,
      y: top - 28,
      width: cardW,
      height: 34,
      color: rgb(0.97, 0.98, 0.98),
      borderColor: rule,
      borderWidth: 0.6,
    });
    page.drawText(pdfSafe(label), { x: x + 6, y: top - 4, size: 7, font, color: muted });
    page.drawText(pdfSafe(value), { x: x + 6, y: top - 20, size: 10, font: bold, color: ink });
  });
  y -= 86;

  text("3. PRODUÇÃO POR PROFISSIONAL", MARGIN, 10, bold, teal);
  y -= 16;
  const docHeaders = ["Médico", "CRM", "Nº", "Total", "Clínica", "Honorário"];
  const docCols = [150, 86, 28, 70, 70, 70];
  docHeaders.forEach((header, index) => {
    const x = MARGIN + docCols.slice(0, index).reduce((a, b) => a + b, 0);
    page.drawText(header, { x, y, size: 7, font: bold, color: muted });
  });
  y -= 12;
  if (report.byDoctor.length === 0) {
    text("Nenhum atendimento concluído no período.", MARGIN, 9, font, muted);
    y -= 13;
  }
  for (const row of report.byDoctor) {
    ensure(16);
    const values = [
      row.doctorName.slice(0, 28),
      row.crm.slice(0, 16),
      String(row.appointments),
      money(row.billedCents),
      money(row.clinicCents),
      money(row.doctorCents),
    ];
    values.forEach((value, index) => {
      const x = MARGIN + docCols.slice(0, index).reduce((a, b) => a + b, 0);
      page.drawText(pdfSafe(value), { x, y, size: 8, font, color: ink });
    });
    y -= 13;
  }

  y -= 8;
  text("4. RELAÇÃO NOMINAL DE ATENDIMENTOS", MARGIN, 10, bold, teal);
  y -= 16;
  const rowHeaders = ["Nº", "Data", "Hora", "Paciente", "Médico / CRM", "Valor", "Sit."];
  const rowCols = [22, 58, 34, 130, 150, 62, 50];
  rowHeaders.forEach((header, index) => {
    const x = MARGIN + rowCols.slice(0, index).reduce((a, b) => a + b, 0);
    page.drawText(header, { x, y, size: 7, font: bold, color: muted });
  });
  y -= 12;
  if (report.rows.length === 0) {
    text("Sem atendimentos no período selecionado.", MARGIN, 9, font, muted);
    y -= 12;
  }
  for (const row of report.rows) {
    ensure(14);
    const values = [
      String(row.n),
      row.date,
      row.time,
      row.patientName.slice(0, 22),
      `${row.doctorName.slice(0, 16)} ${row.crm}`.slice(0, 28),
      money(row.billedCents),
      row.paymentLabel,
    ];
    values.forEach((value, index) => {
      const x = MARGIN + rowCols.slice(0, index).reduce((a, b) => a + b, 0);
      page.drawText(pdfSafe(value), { x, y, size: 8, font, color: ink });
    });
    y -= 12;
  }

  const notes = (report.notes || "").trim();
  if (notes) {
    y -= 10;
    ensure(40);
    text("5. OBSERVACOES", MARGIN, 10, bold, teal);
    y -= 14;
    for (const paragraph of notes.split(/\n+/)) {
      for (const lineText of wrap(paragraph, 98)) {
        if (!lineText) continue;
        ensure(12);
        text(lineText, MARGIN, 8, font, ink);
        y -= 11;
      }
      y -= 6;
    }
    ensure(90);
    y -= 6;
    text("6. ASSINATURAS", MARGIN, 10, bold, teal);
  } else {
    ensure(90);
    y -= 6;
    text("5. ASSINATURAS", MARGIN, 10, bold, teal);
  }
  y -= 40;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 0.8, color: rule });
  page.drawLine({
    start: { x: PAGE.width - MARGIN - 200, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 0.8,
    color: rule,
  });
  y -= 12;
  page.drawText("Gestora / responsável administrativo", { x: MARGIN, y, size: 8, font, color: muted });
  page.drawText("Responsável técnico / médico", { x: PAGE.width - MARGIN - 200, y, size: 8, font, color: muted });
  y -= 22;
  page.drawText(pdfSafe(`Local e data: ${report.clinic.city}, ____/____/________`), {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: muted,
  });
  y -= 14;
  page.drawText("Carimbo da unidade / CNPJ", { x: MARGIN, y, size: 8, font, color: muted });

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    item.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE.width - MARGIN, y: 28 },
      thickness: 0.5,
      color: rule,
    });
    item.drawText(
      pdfSafe(
        `${report.issuer.legalName} - CNPJ ${report.issuer.cnpj} - Documento eletrônico - página ${index + 1}/${pages.length}`,
      ),
      { x: MARGIN, y: 16, size: 7, font, color: muted },
    );
  });

  return doc.save();
}