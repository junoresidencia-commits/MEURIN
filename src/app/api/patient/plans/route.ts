import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { getPatient } from "@/lib/patients-store";
import { getDoctorById, readDb } from "@/lib/store";
import {
  listEnrollmentsByPatient,
  listPromotionsByDoctor,
  listPublicPlans,
} from "@/lib/plans-store";
import { effectivePromotionStatus, isPromotionActive } from "@/lib/plans";

/** Reúne os médicos com quem o paciente tem relação (consultas, contratações, cadastro). */
async function relatedDoctorIds(subject: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const db = await readDb();
  if (subject.includes("@")) {
    db.bookings.filter((b) => b.patientEmail === subject).forEach((b) => ids.add(b.doctorId));
  } else if (subject.startsWith("pid:")) {
    const patient = await getPatient(subject.slice(4));
    if (patient?.doctorId) ids.add(patient.doctorId);
  }
  (await listEnrollmentsByPatient(subject)).forEach((e) => ids.add(e.doctorId));
  return ids;
}

export async function GET(req: Request) {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const explicit = new URL(req.url).searchParams.get("doctorId");
  const doctorIds = explicit ? new Set([explicit]) : await relatedDoctorIds(subject);

  const doctors: {
    doctorId: string;
    doctorName: string;
    plans: unknown[];
    promotions: { id: string; name: string; discountType: string; discountValue: number; endAt?: string }[];
  }[] = [];

  for (const doctorId of doctorIds) {
    const doctor = await getDoctorById(doctorId);
    if (!doctor) continue;
    const plans = await listPublicPlans(doctorId);
    const promotions = (await listPromotionsByDoctor(doctorId))
      .filter((p) => isPromotionActive(p))
      .map((p) => ({ id: p.id, name: p.name, discountType: p.discountType, discountValue: p.discountValue, endAt: p.endAt, effectiveStatus: effectivePromotionStatus(p) }));
    if (plans.length > 0) {
      doctors.push({ doctorId, doctorName: doctor.name, plans, promotions });
    }
  }

  return NextResponse.json({ doctors });
}
