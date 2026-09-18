import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import { cashFlow } from "@/lib/clinic-cash-store";
import { reportRangeFor, type ReportPeriodKey } from "@/lib/report-period";
import type { ClinicExpenseCategory } from "@/lib/platform-types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") || "hoje") as ReportPeriodKey;
  const range = reportRangeFor(["hoje", "semana", "mes", "mes_passado", "ano", "livre"].includes(period) ? period : "hoje");
  const from = url.searchParams.get("from") || range.from;
  const to = url.searchParams.get("to") || range.to;
  const doctorId = url.searchParams.get("doctorId") || undefined;
  const category = (url.searchParams.get("category") || undefined) as ClinicExpenseCategory | undefined;
  const method = url.searchParams.get("method") || undefined;
  const flow = await cashFlow(id, { from, to, doctorId, category, method });
  return NextResponse.json({ flow, clinic: { id: staff.clinic.id, name: staff.clinic.name } });
}
