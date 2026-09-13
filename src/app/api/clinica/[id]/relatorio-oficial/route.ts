import { NextResponse } from "next/server";
import { officialClinicReportPdf } from "@/lib/clinic-official-report-pdf";
import { buildOfficialClinicReport } from "@/lib/official-report-server";
import { requireClinicAdmin } from "@/lib/platform-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!from || !to) return NextResponse.json({ error: "Informe o período (de / até)." }, { status: 400 });
  const destination = url.searchParams.get("destination") || undefined;
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  try {
    const report = await buildOfficialClinicReport(id, from, to, destination);
    if (!report) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    if (format !== "pdf") return NextResponse.json({ report });
    const bytes = await officialClinicReportPdf(report);
    const filename = `prestacao-contas-${report.clinic.name.replace(/[^\w]+/g, "-").toLowerCase()}-${from}-${to}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível montar o relatório oficial. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}