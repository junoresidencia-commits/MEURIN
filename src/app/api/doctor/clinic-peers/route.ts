import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listClinicPeersForDoctor } from "@/lib/clinic-referral-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const doctors = await listClinicPeersForDoctor(doctorId);
    return NextResponse.json({ doctors });
  } catch (err) {
    console.error("[clinic-peers]", err);
    return NextResponse.json({ doctors: [] });
  }
}
