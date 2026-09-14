import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { officialClinicReportPdf } from "../src/lib/clinic-official-report-pdf";
import { officialClinicReportXlsx } from "../src/lib/clinic-official-report-xlsx";
import { upsertFeeRule, createEncounter, recordCheckIn } from "../src/lib/clinic-finance-store";
import { buildOfficialClinicReport } from "../src/lib/official-report-server";
import { defaultOfficialDestination, periodLabel } from "../src/lib/official-report";
import { addMembership, createClinic, updateClinicProfile } from "../src/lib/platform-store";
import { readDb } from "../src/lib/store";

async function main() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Recuse: este teste não pode apontar para Supabase (produção).");
    process.exit(1);
  }

  const db = await readDb();
  const carlos = db.doctors.find((d) => d.email === "carlos@meurim.com");
  assert.ok(carlos, "seed do Dr. Carlos");

  const clinic = await createClinic({
    name: "Clínica Municipal Teste",
    legalName: "CLINICA MUNICIPAL TESTE LTDA",
    cnpj: "12.345.678/0001-90",
    city: "Feira de Santana",
  });
  await addMembership({ clinicId: clinic.id, actorKind: "doctor", actorId: carlos.id, role: "ADMIN_CLINICA" });
  await upsertFeeRule({ clinicId: clinic.id, doctorId: carlos.id, feeCents: 45000, clinicSharePercent: 30 });

  const enc = await createEncounter({
    clinicId: clinic.id,
    doctorId: carlos.id,
    patientKey: `prefeitura.${Date.now()}@meurim.com`,
    patientName: "Maria da Prestação",
  });
  await recordCheckIn({
    clinicId: clinic.id,
    encounterId: enc.id,
    method: "pix",
    amountCents: 45000,
    recordedByKind: "doctor",
  });

  const today = new Date();
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const report = await buildOfficialClinicReport(clinic.id, from, to);
  assert.ok(report);
  assert.equal(report.clinic.cnpj, "12.345.678/0001-90");
  assert.equal(report.clinic.city, "Feira de Santana");
  assert.match(report.destination, /Feira de Santana/);
  assert.equal(report.destination, defaultOfficialDestination("Feira de Santana"));
  assert.equal(report.periodLabel, periodLabel(from, to));
  assert.ok(report.totals.appointments >= 1);
  assert.equal(report.totals.billedCents >= 45000, true);
  assert.ok(report.byDoctor.some((row) => row.doctorId === carlos.id && row.crm.includes(carlos.crm)));
  const row = report.rows.find((item) => item.patientName === "Maria da Prestação");
  assert.ok(row, "relação nominal com o paciente");
  assert.equal(row.paymentLabel, "Quitado");
  assert.ok(row.n >= 1);
  assert.equal(report.warnings.length, 0, "unidade completa não deve ter pendência");
  assert.equal(report.notes, undefined);

  const renamed = await updateClinicProfile(clinic.id, { city: "Salvador" });
  assert.equal(renamed.city, "Salvador");
  const again = await buildOfficialClinicReport(clinic.id, from, to, "Secretaria Municipal de Saúde de Salvador");
  assert.equal(again?.destination, "Secretaria Municipal de Saúde de Salvador");
  assert.equal(again?.clinic.city, "Salvador");

  const bare = await createClinic({ name: "Medclin" });
  const bareReport = await buildOfficialClinicReport(bare.id, from, to);
  assert.ok(bareReport);
  assert.equal(bareReport.warnings.length, 0, "razão social e CNPJ são opcionais");
  assert.equal(bareReport.clinic.cnpj, "—");
  const barePdf = await officialClinicReportPdf(bareReport);
  const bareTxt = Buffer.from(barePdf).toString("latin1");
  assert.equal(bareTxt.includes("Pendencias cadastrais") || bareTxt.includes("Pendências cadastrais"), false);

  const pdf = await officialClinicReportPdf(report);
  assert.ok(pdf.byteLength > 800, `PDF pequeno demais: ${pdf.byteLength}`);
  const head = Buffer.from(pdf.slice(0, 5)).toString("latin1");
  assert.equal(head, "%PDF-");
  const pdfTxt = Buffer.from(pdf).toString("latin1");
  assert.equal(pdfTxt.includes("declara, para os devidos fins"), false);
  assert.equal(pdfTxt.includes("nao substitui nota fiscal") || pdfTxt.includes("não substitui nota fiscal"), false);
  assert.equal(pdfTxt.includes("5. DECLARACAO") || pdfTxt.includes("5. DECLARAÇÃO"), false);

  const noted = await buildOfficialClinicReport(clinic.id, from, to, undefined, "Atendimentos do posto municipal.");
  assert.equal(noted?.notes, "Atendimentos do posto municipal.");
  const notedPdf = await officialClinicReportPdf(noted!);
  const notedTxt = Buffer.from(notedPdf).toString("latin1");
  assert.ok(notedTxt.includes("Atendimentos do posto municipal."));
  assert.ok(notedTxt.includes("5. OBSERVACOES") || notedTxt.includes("5. OBSERVAÇÕES"));

  const xlsx = officialClinicReportXlsx(report);
  assert.ok(xlsx.byteLength > 800, `XLSX pequeno demais: ${xlsx.byteLength}`);
  const book = XLSX.read(xlsx, { type: "array" });
  assert.deepEqual(book.SheetNames, ["Capa", "Por profissional", "Relacao nominal"]);
  const capa = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Capa"]!, { header: 1 });
  const capaText = JSON.stringify(capa);
  assert.equal(capaText.includes("declara, para os devidos fins"), false);
  assert.equal(capaText.includes("não substitui nota fiscal"), false);
  const relacao = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Relacao nominal"]!, { header: 1 });
  const header = relacao[0] as unknown[];
  assert.ok(header.includes("Paciente") && header.includes("CRM"));
  const named = relacao.some((line) => Array.isArray(line) && line.includes("Maria da Prestação"));
  assert.ok(named, "planilha traz a relação nominal");

  const notedXlsx = officialClinicReportXlsx(noted!);
  const notedBook = XLSX.read(notedXlsx, { type: "array" });
  const notedCapa = JSON.stringify(XLSX.utils.sheet_to_json<unknown[]>(notedBook.Sheets["Capa"]!, { header: 1 }));
  assert.ok(notedCapa.includes("Atendimentos do posto municipal."));

  console.log("official-clinic-report ok", {
    documentId: report.documentId,
    destination: report.destination,
    appointments: report.totals.appointments,
    pdfBytes: pdf.byteLength,
    xlsxBytes: xlsx.byteLength,
    sheets: book.SheetNames,
    crm: report.byDoctor[0]?.crm,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});