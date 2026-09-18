import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { COMPANY } from "./company";
import { winAnsiSafe } from "./pdf-winansi";
import { reaisPorExtenso } from "./reais-extenso";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function day(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
  } catch {
    return iso.slice(0, 10);
  }
}

const A4: [number, number] = [595.28, 841.89];

export async function buildReceiptPdf(input: {
  clinicName: string;
  clinicLegalName?: string | null;
  clinicCnpj?: string | null;
  clinicCity?: string | null;
  number: string;
  issuedAt: string;
  amountCents: number;
  serviceLabel: string;
  paymentMethod?: string | null;
  patientName: string;
  patientCpf?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  const gold = rgb(0.15, 0.45, 0.48);
  const text = (value: string, x: number, y: number, size: number, strong = false) => {
    page.drawText(winAnsiSafe(value).slice(0, 110), {
      x,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
  };

  page.drawText(winAnsiSafe(COMPANY.tradeName), { x: 48, y: 800, size: 16, font: bold, color: gold });
  text("RECIBO DE PAGAMENTO", 48, 778, 13, true);
  text(`Nao e Nota Fiscal de Servico eletronica (NFS-e).`, 48, 760, 9);
  text(`Numero ${input.number}`, 48, 742, 10);

  let y = 710;
  const line = (label: string, value: string) => {
    text(label, 48, y, 10);
    text(value, 220, y, 10, true);
    y -= 18;
  };
  line("Clinica", input.clinicName);
  if (input.clinicLegalName) line("Razao social", input.clinicLegalName);
  if (input.clinicCnpj) line("CNPJ", input.clinicCnpj);
  if (input.clinicCity) line("Municipio", input.clinicCity);
  line("Paciente", input.patientName);
  if (input.patientCpf) line("CPF", input.patientCpf);
  if (input.doctorName) line("Medico", input.doctorName);
  if (input.doctorCrm) line("CRM", input.doctorCrm);
  line("Servico", input.serviceLabel);
  line("Data", day(input.issuedAt));
  if (input.paymentMethod) line("Forma de pagamento", input.paymentMethod);
  y -= 8;
  text("Valor", 48, y, 11, true);
  text(brl(input.amountCents), 220, y, 14, true);
  y -= 22;
  text("Valor por extenso", 48, y, 10);
  y -= 16;
  const extenso = winAnsiSafe(reaisPorExtenso(input.amountCents));
  page.drawText(extenso.slice(0, 90), { x: 48, y, size: 11, font: bold, color: rgb(0.12, 0.12, 0.12) });
  y -= 40;
  text("Recebemos a importancia acima referente ao servico descrito.", 48, y, 10);
  y -= 48;
  page.drawLine({ start: { x: 48, y }, end: { x: 280, y }, thickness: 0.8, color: rgb(0.5, 0.5, 0.5) });
  text(input.doctorName || input.clinicName, 48, y - 14, 9);
  if (input.doctorCrm) text(input.doctorCrm, 48, y - 28, 8);
  page.drawText(winAnsiSafe(COMPANY.controllerLine).slice(0, 110), {
    x: 48,
    y: 40,
    size: 7,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
  return pdf.save();
}
