import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { classifyAllPatientsForDoctor } from "@/lib/research-classify";

export async function POST() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const result = await classifyAllPatientsForDoctor(doctorId);
  return NextResponse.json({ ok: true, ...result });
}
