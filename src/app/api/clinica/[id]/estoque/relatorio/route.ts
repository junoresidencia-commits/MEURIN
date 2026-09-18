import { NextResponse } from "next/server";
import { clinicStockPerm, requireClinicStockPerm } from "@/lib/platform-access";
import { stockReportData } from "@/lib/clinic-stock-store";
import { stockReportPdf, stockReportXlsx } from "@/lib/clinic-stock-report";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicStockPerm(id, "stock_manage");
  if (!staff && !(await requireClinicStockPerm(id, "stock_view"))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const viewer = staff || (await requireClinicStockPerm(id, "stock_view"));
  if (!viewer) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "atual";
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const showCosts = clinicStockPerm(viewer, "stock_manage") || viewer.canAdmin;
  if (!showCosts && (kind === "gastos" || kind === "precos" || kind === "compras")) {
    return NextResponse.json({ error: "Sem permissão para ver custos." }, { status: 403 });
  }
  try {
    const report = await stockReportData(id, {
      kind,
      from,
      to,
      productId: url.searchParams.get("productId") || undefined,
      category: url.searchParams.get("category") || undefined,
      supplierId: url.searchParams.get("supplierId") || undefined,
      actorName: url.searchParams.get("actorName") || undefined,
    });
    if (format === "xlsx" || format === "excel") {
      const bytes = stockReportXlsx(viewer.clinic.name, report);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="estoque-${kind}-${from || "tudo"}-${to || "agora"}.xlsx"`,
        },
      });
    }
    if (format === "pdf") {
      const bytes = await stockReportPdf(viewer.clinic.name, report);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="estoque-${kind}.pdf"`,
        },
      });
    }
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Relatório indisponível." }, { status: 400 });
  }
}
