import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { suggestStudies } from "@/lib/research-analysis";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { total, ideas } = await suggestStudies(doctorId);
  return NextResponse.json({ total, ideas });
}
