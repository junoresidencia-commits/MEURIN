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
  notes?: string;
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

export function reportFileSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
