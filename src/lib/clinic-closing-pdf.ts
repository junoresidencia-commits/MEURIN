import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { COMPANY } from "./company";
import { netDoctorPayout } from "./clinic-closing-store";
import type { ClinicClosing, ClinicClosingAdjustment, ClinicEncounter } from "./platform-types";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function day(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const A4: [number, number] = [595.28, 841.89];

async function newPage(pdf: PDFDocument, title: string, font: PDFFont, bold: PDFFont): Promise<PDFPage> {
  const page = pdf.addPage(A4);
  const gold = rgb(0.15, 0.45, 0.48);
  page.drawText(COMPANY.tradeName, { x: 48, y: 800, size: 16, font: bold, color: gold });
  page.drawText(title, { x: 48, y: 778, size: 12, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(COMPANY.legalName, { x: 48, y: 760, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  return page;
}

export async function buildClosingPdf(input: {
  clinicName: string;
  doctorName: string;
  doctorCrm?: string | null;
  closing: ClinicClosing;
  adjustments: ClinicClosingAdjustment[];
  encounters: ClinicEncounter[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = await newPage(pdf, "Fechamento de produção", font, bold);
  const { closing, adjustments, encounters } = input;
  let y = 730;
  const ensure = async (need = 40) => {
    if (y >= need) return;
    page.drawText(`Página ${pdf.getPageCount()} · ${closing.code}`, { x: 48, y: 28, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
    page = await newPage(pdf, "Fechamento de produção (cont.)", font, bold);
    y = 730;
  };
  const line = async (label: string, value: string, strong = false) => {
    await ensure(50);
    page.drawText(label, { x: 48, y, size: 10, font });
    page.drawText(value.slice(0, 60), { x: 250, y, size: 10, font: strong ? bold : font });
    y -= 16;
  };
  await line("Código", closing.code, true);
  await line("Clínica", input.clinicName);
  await line("Médico", input.doctorName);
  if (input.doctorCrm) await line("CRM", input.doctorCrm);
  await line("Período", `${day(closing.periodFrom)} a ${day(closing.periodTo)}`);
  await line("Status", closing.status === "paid" ? "Repasse pago" : "Fechado");
  await line("Atendimentos", String(encounters.length));
  await line("Produção (atendido)", brl(closing.producedCents));
  await line("Recebido (check-in)", brl(closing.receivedCents));
  await line("Parte da clínica", brl(closing.clinicShareCents));
  await line("Repasse do médico", brl(closing.doctorShareCents), true);
  if (adjustments.length) {
    y -= 8;
    await ensure(60);
    page.drawText("Ajustes auditados", { x: 48, y, size: 11, font: bold });
    y -= 16;
    for (const a of adjustments) {
      await ensure(40);
      const sign = a.kind === "debit" ? "−" : "+";
      page.drawText(
        `${day(a.createdAt)}  ${a.kind}  ${sign}${brl(a.amountCents)}  ${a.reason.slice(0, 48)}`,
        { x: 48, y, size: 8, font }
      );
      y -= 12;
    }
    await line("Líquido ao médico", brl(netDoctorPayout(closing, adjustments)), true);
  }
  y -= 8;
  await ensure(80);
  page.drawText("Atendimentos do fechamento", { x: 48, y, size: 11, font: bold });
  y -= 18;
  page.drawText("Data", { x: 48, y, size: 8, font: bold });
  page.drawText("Paciente", { x: 110, y, size: 8, font: bold });
  page.drawText("Produção", { x: 340, y, size: 8, font: bold });
  page.drawText("Recebido", { x: 430, y, size: 8, font: bold });
  y -= 14;
  for (const e of encounters) {
    await ensure(40);
    page.drawText(day(e.attendedAt), { x: 48, y, size: 8, font });
    page.drawText((e.patientName || e.patientKey).slice(0, 36), { x: 110, y, size: 8, font });
    page.drawText(brl(e.feeCents), { x: 340, y, size: 8, font });
    page.drawText(brl(e.receivedCents), { x: 430, y, size: 8, font });
    y -= 12;
  }
  await ensure(120);
  y -= 24;
  page.drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { x: 48, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 36;
  page.drawText("________________________", { x: 48, y, size: 9, font });
  page.drawText("________________________", { x: 320, y, size: 9, font });
  y -= 14;
  page.drawText("Gestora / clínica", { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText("Médico", { x: 320, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText("Documento interno da clínica. Não substitui nota fiscal.", { x: 48, y: 40, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText(`Página ${pdf.getPageCount()} · ${closing.code}`, { x: 48, y: 28, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
  return pdf.save();
}

export async function buildPayoutReceiptPdf(input: {
  clinicName: string;
  doctorName: string;
  closing: ClinicClosing;
  adjustments: ClinicClosingAdjustment[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = await newPage(pdf, "Comprovante de repasse", font, bold);
  const net = netDoctorPayout(input.closing, input.adjustments);
  let y = 720;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 48, y, size: 11, font });
    page.drawText(value, { x: 250, y, size: 11, font: bold });
    y -= 20;
  };
  line("Código", input.closing.code);
  line("Clínica", input.clinicName);
  line("Médico", input.doctorName);
  line("Período", `${day(input.closing.periodFrom)} a ${day(input.closing.periodTo)}`);
  line("Pago em", input.closing.paidAt ? new Date(input.closing.paidAt).toLocaleString("pt-BR") : "—");
  line("Valor do repasse", brl(net));
  y -= 16;
  page.drawText("Este comprovante registra o repasse da clínica ao médico no fechamento acima.", { x: 48, y, size: 9, font });
  y -= 40;
  page.drawText("________________________", { x: 48, y, size: 9, font });
  page.drawText("________________________", { x: 320, y, size: 9, font });
  y -= 14;
  page.drawText("Quem pagou", { x: 48, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText("Médico", { x: 320, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(COMPANY.controllerLine, { x: 48, y: 48, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  return pdf.save();
}
