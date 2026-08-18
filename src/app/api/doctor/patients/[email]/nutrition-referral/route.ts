import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { addReferral } from "@/lib/nutritionists-store";

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const param = decodeURIComponent(email);
  const access = await resolvePatientAccess(param);
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const doctor = await getDoctorById(doctorId);
  const ref = await addReferral({
    doctorId,
    doctorName: doctor?.name ?? null,
    nutritionistId: b.nutritionistId ? String(b.nutritionistId) : null,
    patientKey: access.key,
    patientName: access.name,
    reason: b.reason ? String(b.reason) : null,
    objective: b.objective ? String(b.objective) : null,
    restrictions: b.restrictions ? String(b.restrictions) : null,
    priority: b.priority === "alta" ? "alta" : "normal",
    notes: b.notes ? String(b.notes) : null,
  });
  return NextResponse.json({ ok: true, referral: ref }, { status: 201 });
}
