import "server-only";
import { COMPANY } from "@/lib/company";
import { listEncounters, listFeeRules, productionSummary } from "@/lib/clinic-finance-store";
import { clinicDeclaration, defaultOfficialDestination, formatCrm, paymentLabel, periodLabel, type OfficialClinicReport } from "@/lib/official-report";
import { getClinic } from "@/lib/platform-store";
import { listDoctorsByIds } from "@/lib/store";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowLabel() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function datePart(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const [y, m, day] = iso.slice(0, 10).split("-");
    return y && m && day ? `${day}/${m}/${y}` : "—";
  }
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function timePart(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export async function buildOfficialClinicReport(
  clinicId: string,
  from: string,
  to: string,
  destination?: string,
): Promise<OfficialClinicReport | null> {
  const clinic = await getClinic(clinicId);
  if (!clinic) return null;
  const toBound = to ? `${to}T23:59:59.999Z` : undefined;
  const encounters = await listEncounters(clinicId, from || undefined, toBound);
  const chronological = [...encounters].sort((a, b) => a.attendedAt.localeCompare(b.attendedAt));
  const doctorIds = [...new Set(chronological.map((row) => row.doctorId))];
  const [doctors, rules] = await Promise.all([listDoctorsByIds(doctorIds), listFeeRules(clinicId)]);
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  const ruleById = new Map(rules.map((rule) => [rule.doctorId, rule]));
  const summary = productionSummary(encounters);
  const legalName = clinic.legalName || clinic.name;
  const warnings: string[] = [];

  return {
    kind: "clinic",
    title: "Prestação de contas de atendimentos",
    subtitle: "Relatório oficial de produção assistencial",
    destination: (destination || "").trim() || defaultOfficialDestination(clinic.city),
    documentId: `CLINICA-${clinic.id.slice(0, 8).toUpperCase()}-${(from || "inicio").replaceAll("-", "")}-${(to || "hoje").replaceAll("-", "")}`,
    issuedAt: nowLabel(),
    periodFrom: from,
    periodTo: to,
    periodLabel: periodLabel(from, to),
    clinic: {
      id: clinic.id,
      name: clinic.name,
      legalName,
      cnpj: clinic.cnpj || "—",
      city: clinic.city || "—",
    },
    totals: {
      appointments: summary.count,
      billedCents: summary.producedCents,
      receivedCents: summary.receivedCents,
      pendingCents: summary.pendingCents,
      clinicCents: summary.clinicShareCents,
      doctorCents: summary.doctorShareCents,
    },
    byDoctor: summary.byDoctor.map((row) => {
      const doctor = doctorById.get(row.doctorId);
      const rule = ruleById.get(row.doctorId);
      return {
        doctorId: row.doctorId,
        doctorName: doctor?.name || "Médico",
        crm: formatCrm(doctor?.crm, doctor?.crmState),
        appointments: row.count,
        billedCents: row.producedCents,
        receivedCents: row.receivedCents,
        pendingCents: row.pendingCents,
        clinicCents: row.clinicShareCents,
        doctorCents: row.doctorShareCents,
        feeCents: rule?.feeCents ?? null,
        clinicSharePercent: rule?.clinicSharePercent ?? null,
      };
    }),
    rows: chronological.map((row, index) => {
      const doctor = doctorById.get(row.doctorId);
      return {
        n: index + 1,
        date: datePart(row.attendedAt),
        time: timePart(row.attendedAt),
        patientName: (row.patientName || "").trim() || "Não informado",
        doctorName: doctor?.name || "Médico",
        crm: formatCrm(doctor?.crm, doctor?.crmState),
        billedCents: row.feeCents,
        receivedCents: row.receivedCents,
        clinicCents: row.clinicShareCents,
        doctorCents: row.doctorShareCents,
        paymentLabel: paymentLabel(row.paymentStatus),
      };
    }),
    declaration: clinicDeclaration(legalName),
    warnings,
    issuer: COMPANY,
  };
}