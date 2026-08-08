import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { getDoctorById, listFinancialEvents } from "@/lib/store";
import { resolveDoctorSharePercent } from "@/lib/types";

/** Detalhe financeiro de um médico (visão do administrador) + histórico de alterações. */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const doctorId = new URL(req.url).searchParams.get("doctorId");
  if (!doctorId) {
    return NextResponse.json({ error: "doctorId obrigatório." }, { status: 400 });
  }
  const doctor = await getDoctorById(doctorId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico não encontrado." }, { status: 404 });
  }
  const commissionPercent = resolveDoctorSharePercent(doctor);
  const history = await listFinancialEvents(doctorId);
  return NextResponse.json({
    doctorId,
    name: doctor.name,
    consultationPriceCents: doctor.consultationPriceCents,
    commissionPercent,
    platformPercent: 100 - commissionPercent,
    payoutStatus: doctor.payoutStatus ?? "active",
    mpConnected: Boolean(doctor.mpAccessToken?.trim()),
    history,
  });
}
