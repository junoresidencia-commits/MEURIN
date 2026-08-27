import { NextResponse } from "next/server";
import { getPatientEmail } from "@/lib/patient-session";
import { findByEmailAny, getPatient, clinicalKey } from "@/lib/patients-store";
import { getDoctorById } from "@/lib/store";
import { listReferralsForPatient, getNutritionist } from "@/lib/nutritionists-store";
import { listAlliedReferralsForPatient, currentAssignment, getAlliedProfessional } from "@/lib/allied-store";
import { unreadInThread, type CareChatRole } from "@/lib/care-messages-store";

export async function GET() {
  const subject = await getPatientEmail();
  if (!subject) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const patient = subject.startsWith("pid:") ? await getPatient(subject.slice(4)) : await findByEmailAny(subject);
  if (!patient) return NextResponse.json({ nephrologist: null, team: [] });

  const doctor = await getDoctorById(patient.doctorId);
  const key = clinicalKey(patient);
  const keys = [key, patient.email?.toLowerCase() || ""].filter(Boolean);

  let nutRefs = await listReferralsForPatient(key);
  if (keys[1] && keys[1] !== key) nutRefs = nutRefs.concat(await listReferralsForPatient(keys[1]));
  const nutRef = nutRefs.find((r) => r.status !== "encerrado" && r.nutritionistId);
  const nut = nutRef?.nutritionistId ? await getNutritionist(nutRef.nutritionistId) : null;

  let alliedRefs = await listAlliedReferralsForPatient(key);
  if (keys[1] && keys[1] !== key) alliedRefs = alliedRefs.concat(await listAlliedReferralsForPatient(keys[1]));
  const psy = currentAssignment(alliedRefs, "psychology");
  const nur = currentAssignment(alliedRefs, "nursing");
  const psyPro = psy ? await getAlliedProfessional(psy.professionalId) : null;
  const nurPro = nur ? await getAlliedProfessional(nur.professionalId) : null;

  async function member(
    role: CareChatRole,
    id: string,
    name: string,
    registry: string,
    email?: string | null,
    phone?: string | null,
    reason?: string | null,
    referredAt?: string | null,
  ) {
    const unread = await unreadInThread(role, id, key, "professional");
    return { role, professionalId: id, name, registry, email: email || null, phone: phone || null, reason: reason || null, referredAt: referredAt || null, unread };
  }

  const team = [
    nut && nutRef?.nutritionistId
      ? await member("nutrition", nut.id, nut.name, nut.crn ? `CRN ${nut.crn}${nut.uf ? "-" + nut.uf : ""}` : "", nut.email, nut.phone, nutRef.reason, nutRef.createdAt)
      : null,
    psyPro && psy
      ? await member("psychology", psyPro.id, psyPro.name, psyPro.registry ? `CRP ${psyPro.registry}${psyPro.uf ? "-" + psyPro.uf : ""}` : "", psyPro.email, psyPro.phone, psy.reason, psy.createdAt)
      : null,
    nurPro && nur
      ? await member("nursing", nurPro.id, nurPro.name, nurPro.registry ? `COREN ${nurPro.registry}${nurPro.uf ? "-" + nurPro.uf : ""}` : "", nurPro.email, nurPro.phone, nur.reason, nur.createdAt)
      : null,
  ].filter(Boolean);

  return NextResponse.json({
    nephrologist: doctor ? { name: doctor.name, crm: doctor.crm, specialty: doctor.specialty } : null,
    team,
  });
}
