import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { winAnsiSafe } from "./pdf-winansi";
import { stockReportData } from "./clinic-stock-store";

type Report = Awaited<ReturnType<typeof stockReportData>>;

const KIND_TITLE: Record<string, string> = {
  atual: "Estoque atual",
  entradas: "Entradas de estoque",
  saidas: "Saídas de estoque",
  perdas: "Perdas e avarias",
  vencidos: "Produtos vencidos ou a vencer",
  compras: "Compras",
  gastos: "Gastos com materiais",
  precos: "Histórico de preços",
};

const HEADERS: Record<string, string[]> = {
  atual: ["Produto", "Categoria", "Quantidade", "Status", "Custo médio"],
  entradas: ["Produto", "Data", "Movimento", "Valor", "Responsável"],
  saidas: ["Produto", "Data", "Movimento", "Valor", "Responsável"],
  perdas: ["Produto", "Data", "Movimento", "Valor", "Motivo"],
  vencidos: ["Produto", "Validade", "Alerta", "Quantidade", "Lotes"],
  compras: ["Produto", "Data", "Movimento", "Valor", "Fornecedor"],
  gastos: ["Produto", "Data", "Movimento", "Valor", "Fornecedor"],
  precos: ["Produto", "Data", "Preço unitário", "Qtd", "Fornecedor"],
};

export async function stockReportPdf(clinicName: string, report: Report): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = KIND_TITLE[report.kind] || "Relatório de estoque";
  const headers = HEADERS[report.kind] || HEADERS.atual;
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  const draw = (value: string, x: number, size: number, strong = false) => {
    page.drawText(winAnsiSafe(value).slice(0, 90), {
      x,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
  };
  draw("Meu Rim", 40, 11, true);
  y -= 18;
  draw(clinicName, 40, 13, true);
  y -= 16;
  draw(title, 40, 11, true);
  y -= 14;
  draw(`Periodo: ${report.from || "-"} a ${report.to || "-"}`, 40, 9);
  y -= 22;
  const cols = [40, 160, 270, 370, 460];
  headers.forEach((h, i) => {
    page.drawText(winAnsiSafe(h).slice(0, 18), { x: cols[i], y, size: 8, font: bold, color: rgb(0.15, 0.45, 0.48) });
  });
  y -= 14;
  for (const row of report.rows) {
    if (y < 50) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    [row.col1, row.col2, row.col3, row.col4, row.col5].forEach((cell, i) => {
      page.drawText(winAnsiSafe(String(cell || "-")).slice(0, 22), { x: cols[i], y, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
    });
    y -= 12;
  }
  return pdf.save();
}

export function stockReportXlsx(clinicName: string, report: Report): Uint8Array {
  const title = KIND_TITLE[report.kind] || "Relatorio de estoque";
  const headers = HEADERS[report.kind] || HEADERS.atual;
  const aoa = [
    ["Meu Rim", clinicName],
    [title, `Periodo ${report.from || "-"} a ${report.to || "-"}`],
    [],
    headers,
    ...report.rows.map((r) => [r.col1, r.col2, r.col3, r.col4, r.col5]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Estoque");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
