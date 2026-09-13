import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { listClinics } from "@/lib/platform-store";
import { listDoctors } from "@/lib/store";
import { getMrrSummary, listLicenses, listPlans } from "@/lib/saas-store";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const [plans, licenses, mrr, clinics, doctors] = await Promise.all([
    listPlans(true),
    listLicenses(),
    getMrrSummary(),
    listClinics(),
    listDoctors(),
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const clinicById = new Map(clinics.map((c) => [c.id, c]));
  const doctorById = new Map(doctors.map((d) => [d.id, d]));
  return NextResponse.json({
    note: "SaaS separado do financeiro da clínica. Sem licença a área médica continua liberada.",
    mrr,
    plans: plans.filter((p) => p.active),
    licenses: licenses.map((l) => ({
      ...l,
      planName: planById.get(l.planId)?.name || "Plano",
      clinicName: l.clinicId ? clinicById.get(l.clinicId)?.name || null : null,
      doctorName: l.doctorId ? doctorById.get(l.doctorId)?.name || null : null,
      doctorEmail: l.doctorId ? doctorById.get(l.doctorId)?.email || null : null,
    })),
    clinics: clinics.map((c) => ({ id: c.id, name: c.name })),
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, email: d.email })),
  });
}
