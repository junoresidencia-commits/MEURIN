import * as XLSX from "xlsx";
import { type OfficialClinicReport } from "@/lib/official-report";

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

export function officialClinicReportXlsx(report: OfficialClinicReport): Buffer {
  const wb = XLSX.utils.book_new();

  const capa = XLSX.utils.aoa_to_sheet([
    [report.title],
    [report.subtitle],
    [],
    ["Destinatário", report.destination],
    ["Documento", report.documentId],
    ["Emitido em", report.issuedAt],
    ["Período de competência", report.periodLabel],
    [],
    ["Nome fantasia", report.clinic.name],
    ["Razão social", report.clinic.legalName],
    ["CNPJ", report.clinic.cnpj],
    ["Município", report.clinic.city],
    [],
    ["Atendimentos", report.totals.appointments],
    ["Valor total", reais(report.totals.billedCents)],
    ["Recebido", reais(report.totals.receivedCents)],
    ["Pendente", reais(report.totals.pendingCents)],
    ["Retenção clínica", reais(report.totals.clinicCents)],
    ["Honorários", reais(report.totals.doctorCents)],
    [],
    ...report.declaration.map((line) => [line]),
  ]);
  capa["!cols"] = [{ wch: 28 }, { wch: 72 }];
  applyMoney(capa, ["B"], 15, 19);
  XLSX.utils.book_append_sheet(wb, capa, "Capa");

  const doctors = [
    ["Médico", "CRM", "Atendimentos", "Valor total", "Recebido", "Pendente", "Clínica", "Honorário", "Valor vigente", "% clínica"],
    ...report.byDoctor.map((row) => [
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
      report.totals.appointments,
      reais(report.totals.billedCents),
      reais(report.totals.receivedCents),
      reais(report.totals.pendingCents),
      reais(report.totals.clinicCents),
      reais(report.totals.doctorCents),
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
    ...report.rows.map((row) => [
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
      reais(report.totals.billedCents),
      reais(report.totals.receivedCents),
      reais(report.totals.clinicCents),
      reais(report.totals.doctorCents),
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

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}