import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { resolveDoctorSharePercent } from "@/lib/types";

/**
 * Visão financeira do próprio médico. O percentual é SOMENTE leitura aqui —
 * apenas o administrador pode alterá-lo (ver /api/admin/doctors PATCH).
 */
export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctor = await getDoctorById(doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  const commissionPercent = resolveDoctorSharePercent(doctor);
  return NextResponse.json({
    consultationPriceCents: doctor.consultationPriceCents,
    commissionPercent,
    platformPercent: 100 - commissionPercent,
    payoutStatus: doctor.payoutStatus ?? "active",
    mpConnected: Boolean(doctor.mpAccessToken?.trim()),
  });
}
