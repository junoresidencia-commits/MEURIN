import * as XLSX from "xlsx";
import { clinicDeclaration, type OfficialClinicReport } from "@/lib/official-report";

function reais(cents: number) {
  return Math.round(cents) / 100;
}

function applyMoney(sheet: XLSX.WorkSheet, cols: string[], fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (const col of cols) {
      const cell = sheet[`${col}${r}`];
      if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
    }
  }
}

export type ClinicWorkbookInput = {
  title?: string;
  subtitle?: string;
  destination: string;
  documentId?: string;
  issuedAt?: string;
  periodLabel: string;
  clinic: { name: string; legalName: string; cnpj: string; city: string };
  totals: {
    appointments: number;
    billedCents: number;
    receivedCents: number;
    pendingCents: number;
    clinicCents: number;
    doctorCents: number;
  };
  byDoctor: Array<{
    doctorName: string;
    crm: string;
    appointments: number;
    billedCents: number;
    receivedCents: number;
    pendingCents: number;
    clinicCents: number;
    doctorCents: number;
    feeCents: number | null;
    clinicSharePercent: number | null;
  }>;
  rows: Array<{
    n: number;
    date: string;
    time: string;
    patientName: string;
    doctorName: string;
    crm: string;
    billedCents: number;
    receivedCents: number;
    clinicCents: number;
    doctorCents: number;
    paymentLabel: string;
  }>;
  declaration?: string[];
};

export function clinicReportWorkbook(input: ClinicWorkbookInput) {
  const wb = XLSX.utils.book_new();
  const declaration = input.declaration?.length
    ? input.declaration
    : clinicDeclaration(input.clinic.legalName || input.clinic.name || "clínica");

  const capa = XLSX.utils.aoa_to_sheet([
    [input.title || "Prestação de contas de atendimentos"],
    [input.subtitle || "Relatório oficial de produção assistencial"],
    [],
    ["Destinatário", input.destination],
    ["Documento", input.documentId || ""],
    ["Emitido em", input.issuedAt || ""],
    ["Período de competência", input.periodLabel],
    [],
    ["Nome fantasia", input.clinic.name],
    ["Razão social", input.clinic.legalName],
    ["CNPJ", input.clinic.cnpj],
    ["Município", input.clinic.city],
    [],
    ["Atendimentos", input.totals.appointments],
    ["Valor total", reais(input.totals.billedCents)],
    ["Recebido", reais(input.totals.receivedCents)],
    ["Pendente", reais(input.totals.pendingCents)],
    ["Retenção clínica", reais(input.totals.clinicCents)],
    ["Honorários", reais(input.totals.doctorCents)],
    [],
    ...declaration.map((line) => [line]),
  ]);
  capa["!cols"] = [{ wch: 28 }, { wch: 72 }];
  applyMoney(capa, ["B"], 15, 19);
  XLSX.utils.book_append_sheet(wb, capa, "Capa");

  const doctors = [
    ["Médico", "CRM", "Atendimentos", "Valor total", "Recebido", "Pendente", "Clínica", "Honorário", "Valor vigente", "% clínica"],
    ...input.byDoctor.map((row) => [
      row.doctorName,
      row.crm,
      row.appointments,
      reais(row.billedCents),
      reais(row.receivedCents),
      reais(row.pendingCents),
      reais(row.clinicCents),
      reais(row.doctorCents),
      row.feeCents == null ? "" : reais(row.feeCents),
      row.clinicSharePercent == null ? "" : row.clinicSharePercent,
    ]),
    [
      "TOTAL",
      "",
      input.totals.appointments,
      reais(input.totals.billedCents),
      reais(input.totals.receivedCents),
      reais(input.totals.pendingCents),
      reais(input.totals.clinicCents),
      reais(input.totals.doctorCents),
      "",
      "",
    ],
  ];
  const porMedico = XLSX.utils.aoa_to_sheet(doctors);
  porMedico["!cols"] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
  ];
  applyMoney(porMedico, ["D", "E", "F", "G", "H", "I"], 2, doctors.length);
  if (doctors.length > 1) porMedico["!autofilter"] = { ref: `A1:J${doctors.length - 1}` };
  XLSX.utils.book_append_sheet(wb, porMedico, "Por profissional");

  const nominal = [
    ["Nº", "Data", "Hora", "Paciente", "Médico", "CRM", "Valor", "Recebido", "Clínica", "Honorário", "Situação"],
    ...input.rows.map((row) => [
      row.n,
      row.date,
      row.time,
      row.patientName,
      row.doctorName,
      row.crm,
      reais(row.billedCents),
      reais(row.receivedCents),
      reais(row.clinicCents),
      reais(row.doctorCents),
      row.paymentLabel,
    ]),
    [
      "",
      "",
      "",
      "TOTAL",
      "",
      "",
      reais(input.totals.billedCents),
      reais(input.totals.receivedCents),
      reais(input.totals.clinicCents),
      reais(input.totals.doctorCents),
      "",
    ],
  ];
  const relacao = XLSX.utils.aoa_to_sheet(nominal);
  relacao["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 8 },
    { wch: 32 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  applyMoney(relacao, ["G", "H", "I", "J"], 2, nominal.length);
  if (nominal.length > 1) relacao["!autofilter"] = { ref: `A1:K${Math.max(1, nominal.length - 1)}` };
  XLSX.utils.book_append_sheet(wb, relacao, "Relacao nominal");
  return wb;
}

export function clinicReportXlsxBytes(input: ClinicWorkbookInput): Uint8Array {
  const out = XLSX.write(clinicReportWorkbook(input), { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

export function officialClinicReportXlsx(report: OfficialClinicReport): Uint8Array {
  return clinicReportXlsxBytes({
    title: report.title,
    subtitle: report.subtitle,
    destination: report.destination,
    documentId: report.documentId,
    issuedAt: report.issuedAt,
    periodLabel: report.periodLabel,
    clinic: report.clinic,
    totals: report.totals,
    byDoctor: report.byDoctor.map((row) => ({
      doctorName: row.doctorName,
      crm: row.crm,
      appointments: row.appointments,
      billedCents: row.billedCents,
      receivedCents: row.receivedCents,
      pendingCents: row.pendingCents,
      clinicCents: row.clinicCents,
      doctorCents: row.doctorCents,
      feeCents: row.feeCents,
      clinicSharePercent: row.clinicSharePercent,
    })),
    rows: report.rows,
    declaration: report.declaration,
  });
}