import { NextResponse } from "next/server";
import { officialClinicReportPdf } from "@/lib/clinic-official-report-pdf";
import { officialClinicReportXlsx } from "@/lib/clinic-official-report-xlsx";
import { reportFileSlug } from "@/lib/official-report";
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
  const notes = (url.searchParams.get("notes") || "").trim().slice(0, 4000) || undefined;
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  try {
    const report = await buildOfficialClinicReport(id, from, to, destination, notes);
    if (!report) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });
    const slug = reportFileSlug(report.clinic.name) || "clinica";
    if (format === "xlsx" || format === "excel") {
      const bytes = officialClinicReportXlsx(report);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="prestacao-contas-${slug}-${from}-${to}.xlsx"`,
        },
      });
    }
    if (format === "pdf") {
      const bytes = await officialClinicReportPdf(report);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="prestacao-contas-${slug}-${from}-${to}.pdf"`,
        },
      });
    }
    return NextResponse.json({ report });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível montar o relatório oficial. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}