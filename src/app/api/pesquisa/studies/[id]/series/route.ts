import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getStudy } from "@/lib/research-studies-store";
import { cohortSeries } from "@/lib/research-analysis";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const study = await getStudy(doctorId, id);
  if (!study) return NextResponse.json({ error: "Estudo não encontrado." }, { status: 404 });
  const testKey = new URL(req.url).searchParams.get("testKey") || "tfge";
  const series = await cohortSeries(doctorId, study.filters, testKey);
  return NextResponse.json({ testKey, series });
}
