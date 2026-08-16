import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listCases } from "@/lib/research-studies-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const cases = await listCases(doctorId);
  return NextResponse.json({ cases });
}
