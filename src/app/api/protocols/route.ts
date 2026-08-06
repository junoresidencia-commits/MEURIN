import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listProtocols } from "@/lib/protocols-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.json({ protocols: await listProtocols(true) });
}
