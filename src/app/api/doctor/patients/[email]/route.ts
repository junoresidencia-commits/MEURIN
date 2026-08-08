import { NextResponse } from "next/server";
import { getClinicalNotes, getDocuments, getLabResults, getPatientData } from "@/lib/patient-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { listUploads } from "@/lib/uploads-store";
import { listLme } from "@/lib/lme-store";
import { listEnrollmentsByPatient } from "@/lib/plans-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);

  if (!access) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const { records, food } = await getPatientData(access.key);
  const notes = await getClinicalNotes(access.key);
  const documents = await getDocuments(access.key);
  const labs = await getLabResults(access.key);
  const uploads = await listUploads(access.key);
  const lme = await listLme(access.key);
  const enrollments = await listEnrollmentsByPatient(access.key);

  return NextResponse.json({
    patient: {
      key: access.key,
      email: access.email,
      name: access.name,
      city: access.city,
      phone: access.phone,
      isCreated: access.isCreated,
    },
    bookings: access.bookings,
    records,
    food,
    notes,
    documents,
    labs,
    uploads,
    lme,
    enrollments,
  });
}
