import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listLmeByDoctor } from "@/lib/lme-store";

// Lista as LME do médico (para a página /medicos/lme e "LME para assinar").
export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const list = await listLmeByDoctor(doctorId);
  const items = list.map((l) => ({
    id: l.id,
    patientName: l.patientName || l.patientEmail,
    cid10: l.cid10 || null,
    diagnosis: l.diagnosis || null,
    medsCount: l.medications?.length || 0,
    signedAt: l.signedAt || null,
    createdAt: l.createdAt,
  }));
  return NextResponse.json({ items, paraAssinar: items.filter((i) => !i.signedAt).length });
}
