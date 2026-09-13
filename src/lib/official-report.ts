import { COMPANY } from "@/lib/company";
import type { EncounterPaymentStatus } from "@/lib/platform-types";

export type OfficialClinicReport = {
  kind: "clinic";
  title: string;
  subtitle: string;
  destination: string;
  documentId: string;
  issuedAt: string;
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  clinic: {
    id: string;
    name: string;
    legalName: string;
    cnpj: string;
    city: string;
  };
  totals: {
    appointments: number;
    billedCents: number;
    receivedCents: number;
    pendingCents: number;
    clinicCents: number;
    doctorCents: number;
  };
  byDoctor: Array<{
    doctorId: string;
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
  declaration: string[];
  warnings: string[];
  issuer: typeof COMPANY;
};

export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function periodLabel(from: string, to: string) {
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (!fy || !fm || !fd || !ty || !tm || !td) return `${from} a ${to}`;
  return `${fd}/${fm}/${fy} a ${td}/${tm}/${ty}`;
}

export function paymentLabel(status: EncounterPaymentStatus) {
  if (status === "paid") return "Quitado";
  if (status === "partial") return "Parcial";
  if (status === "courtesy") return "Cortesia";
  return "Pendente";
}

export function defaultOfficialDestination(city?: string | null) {
  const municipio = (city || "").trim();
  if (municipio) return `Prefeitura Municipal de ${municipio} / Secretaria Municipal de Saúde`;
  return "Prefeitura Municipal / Secretaria Municipal de Saúde";
}

export function formatCrm(crm?: string | null, crmState?: string | null) {
  const number = (crm || "").trim();
  const uf = (crmState || "").trim();
  if (!number) return "—";
  if (/^crm\b/i.test(number)) return number;
  return uf ? `CRM ${number}/${uf}` : `CRM ${number}`;
}

export function clinicDeclaration(clinicName: string) {
  return [
    `A unidade ${clinicName} declara, para os devidos fins junto à Prefeitura Municipal, Secretaria Municipal de Saúde e demais órgãos de controle, que os atendimentos relacionados neste documento foram efetivamente realizados no período de competência indicado.`,
    "Os valores correspondem à produção assistencial e ao rateio contratual entre a clínica e o(s) profissional(is) de saúde. Este relatório serve como prestação de contas administrativa e não substitui nota fiscal, RPA, recibo de honorários, SISAB/e-SUS ou faturamento de convênio.",
    "A relação nominal identifica o paciente, o profissional responsável (com CRM) e o valor da consulta, para conferência da gestão municipal e arquivo da clínica.",
  ];
}