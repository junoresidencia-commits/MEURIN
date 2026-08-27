import { NextResponse } from "next/server";
import { requireAllied, resolveAlliedPatientAccess } from "@/lib/allied-access";
import { listNotesForPatient } from "@/lib/allied-store";
import { buildClinicalSnapshot, isPdPatient } from "@/lib/clinical-snapshot";
import { computePdAlerts } from "@/lib/pd-alerts";
import {
  getPdProfile, listPdAdequacy, listPdCatheterEvals, listPdDailyLogs,
  listPdPeritonitis, listPdPrescriptions, listPdTraining,
} from "@/lib/pd-store";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const patientKey = decodeURIComponent(key);
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolveAlliedPatientAccess(patientKey, pro);
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente. Somente pacientes encaminhados a você." }, { status: 403 });

  const snapshot = await buildClinicalSnapshot(access.key, pro.role);
  const notes = await listNotesForPatient(access.key, pro.role);
  const pd = isPdPatient(snapshot) && pro.role === "nursing";
  const pdBundle = pd ? {
    profile: await getPdProfile(access.key),
    prescriptions: await listPdPrescriptions(access.key),
    logs: await listPdDailyLogs(access.key),
    catheter: await listPdCatheterEvals(access.key),
    peritonitis: await listPdPeritonitis(access.key),
    adequacy: await listPdAdequacy(access.key),
    training: await listPdTraining(access.key),
  } : null;
  const alerts = pdBundle ? computePdAlerts(pdBundle.logs, pdBundle.catheter) : [];

  return NextResponse.json({
    patient: { key: access.key, name: access.name, birthdate: access.birthdate, sex: access.sex, cpf: access.cpf },
    snapshot,
    notes,
    pd: pdBundle,
    alerts,
    isPd: pd,
  });
}
