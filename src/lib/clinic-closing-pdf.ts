import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

async function baseDoc(title: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.15, 0.45, 0.48);
  page.drawText(COMPANY.tradeName, { x: 48, y: 800, size: 16, font: bold, color: gold });
  page.drawText(title, { x: 48, y: 778, size: 12, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(COMPANY.legalName, { x: 48, y: 760, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  return { pdf, page, font, bold };
}

export async function buildClosingPdf(input: {
  clinicName: string;
  doctorName: string;
  closing: ClinicClosing;
  adjustments: ClinicClosingAdjustment[];
  encounters: ClinicEncounter[];
}): Promise<Uint8Array> {
  const { pdf, page, font, bold } = await baseDoc("Fechamento de produção");
  const { closing, adjustments, encounters } = input;
  let y = 730;
  const line = (label: string, value: string, strong = false) => {
    page.drawText(label, { x: 48, y, size: 10, font });
    page.drawText(value, { x: 250, y, size: 10, font: strong ? bold : font });
    y -= 16;
  };
  line("Código", closing.code, true);
  line("Clínica", input.clinicName);
  line("Médico", input.doctorName);
  line("Período", `${day(closing.periodFrom)} a ${day(closing.periodTo)}`);
  line("Status", closing.status === "paid" ? "Repasse pago" : "Fechado");
  line("Atendimentos", String(encounters.length));
  line("Produção (atendido)", brl(closing.producedCents));
  line("Recebido (check-in)", brl(closing.receivedCents));
  line("Parte da clínica", brl(closing.clinicShareCents));
  line("Repasse do médico", brl(closing.doctorShareCents), true);
  if (adjustments.length) {
    y -= 8;
    page.drawText("Ajustes auditados", { x: 48, y, size: 11, font: bold });
    y -= 16;
    for (const a of adjustments) {
      const sign = a.kind === "debit" ? "−" : "+";
      page.drawText(`${day(a.createdAt)}  ${a.kind}  ${sign}${brl(a.amountCents)}  ${a.reason}`, { x: 48, y, size: 8, font });
      y -= 12;
    }
    line("Líquido ao médico", brl(netDoctorPayout(closing, adjustments)), true);
  }
  y -= 12;
  page.drawText("Atendimentos do fechamento", { x: 48, y, size: 11, font: bold });
  y -= 16;
  for (const e of encounters.slice(0, 28)) {
    page.drawText(
      `${day(e.attendedAt)}  ${(e.patientName || e.patientKey).slice(0, 32)}  prod ${brl(e.feeCents)}  rec ${brl(e.receivedCents)}`,
      { x: 48, y, size: 8, font }
    );
    y -= 12;
    if (y < 60) break;
  }
  page.drawText("Documento interno da clínica. Não substitui nota fiscal.", { x: 48, y: 40, size: 8, font, color: rgb(0.45, 0.45, 0.45) });
  return pdf.save();
}

export async function buildPayoutReceiptPdf(input: {
  clinicName: string;
  doctorName: string;
  closing: ClinicClosing;
  adjustments: ClinicClosingAdjustment[];
}): Promise<Uint8Array> {
  const { pdf, page, font, bold } = await baseDoc("Comprovante de repasse");
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
  y -= 14;
  page.drawText("Ajustes posteriores, se houver, ficam auditados no PDF do fechamento.", { x: 48, y, size: 9, font });
  page.drawText(COMPANY.controllerLine, { x: 48, y: 48, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  return pdf.save();
}
