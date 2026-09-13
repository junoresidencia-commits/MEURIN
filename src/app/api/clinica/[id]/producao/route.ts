import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listEncounters, listFeeRules, productionSummary } from "@/lib/clinic-finance-store";
import { formatCrm } from "@/lib/official-report";
import { getClinic } from "@/lib/platform-store";
import { listDoctorsByIds } from "@/lib/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const doctorId = url.searchParams.get("doctorId") || undefined;
  let encounters = await listEncounters(id, from, to ? `${to}T23:59:59.999Z` : undefined);
  if (doctorId) encounters = encounters.filter((e) => e.doctorId === doctorId);
  const [doctors, rules, clinic] = await Promise.all([
    listDoctorsByIds(encounters.map((e) => e.doctorId)),
    listFeeRules(id),
    getClinic(id),
  ]);
  const doctorById = new Map(doctors.map((d) => [d.id, d]));
  const ruleById = new Map(rules.map((r) => [r.doctorId, r]));
  const named = encounters.map((e) => {
    const doctor = doctorById.get(e.doctorId);
    return {
      ...e,
      doctorName: doctor?.name || "Médico",
      doctorCrm: formatCrm(doctor?.crm, doctor?.crmState),
    };
  });
  const summary = productionSummary(encounters);
  return NextResponse.json({
    clinic: clinic
      ? { id: clinic.id, name: clinic.name, legalName: clinic.legalName, cnpj: clinic.cnpj, city: clinic.city }
      : null,
    encounters: named,
    summary: {
      ...summary,
      byDoctor: summary.byDoctor.map((row) => {
        const rule = ruleById.get(row.doctorId);
        const doctor = doctorById.get(row.doctorId);
        return {
          ...row,
          doctorName: doctor?.name || "Médico",
          doctorCrm: formatCrm(doctor?.crm, doctor?.crmState),
          feeCents: rule?.feeCents ?? null,
          clinicSharePercent: rule?.clinicSharePercent ?? null,
        };
      }),
    },
  });
}
