import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { requireClinicAdmin } from "@/lib/platform-access";
import { operationalResult, EXPENSE_CATEGORY_LABEL } from "@/lib/clinic-cash-store";
import { listDoctorsByIds } from "@/lib/store";
import { winAnsiSafe } from "@/lib/pdf-winansi";
import { reportRangeFor, type ReportPeriodKey } from "@/lib/report-period";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function reais(cents: number) {
  return Math.round(cents) / 100;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") || "mes") as ReportPeriodKey;
  const range = reportRangeFor(["hoje", "semana", "mes", "mes_passado", "ano", "livre"].includes(period) ? period : "mes");
  const from = url.searchParams.get("from") || range.from;
  const to = url.searchParams.get("to") || range.to;
  const result = await operationalResult(id, from, to);
  const doctors = await listDoctorsByIds(result.byDoctor.map((d) => d.doctorId));
  const byId = new Map(doctors.map((d) => [d.id, d]));
  const named = result.byDoctor.map((row) => ({
    ...row,
    doctorName: byId.get(row.doctorId)?.name || "Médico",
  }));
  const payload = { ...result, byDoctor: named, clinic: staff.clinic };

  const format = url.searchParams.get("format");
  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Resultado operacional"],
        [staff.clinic.name],
        ["Período", `${from} a ${to}`],
        [],
        ["Receita bruta (consultas)", reais(result.receitaBrutaCents)],
        ["Procedimentos", reais(result.receitas.procedimentosCents)],
        ["Outros recebimentos", reais(result.receitas.outrosCents)],
        [],
        ["Despesas — materiais", reais(result.despesas.materiaisCents)],
        ["Despesas — funcionários/prestadores", reais(result.despesas.funcionariosCents)],
        ["Despesas — manutenção", reais(result.despesas.manutencaoCents)],
        ["Despesas — taxas", reais(result.despesas.taxasCents)],
        ["Despesas — outros", reais(result.despesas.outrosCents)],
        ["Despesas totais", reais(result.despesaTotalCents)],
        [],
        ["Resultado operacional", reais(result.resultadoCents)],
        ["Parte da clínica (repasse)", reais(result.clinicShareCents)],
        ["Parte dos médicos (repasse)", reais(result.doctorShareCents)],
      ]),
      "Resultado"
    );
    const despesaRows = [
      ["Data", "Descrição", "Categoria", "Valor"],
      ...result.expenses.map((e) => [
        e.occurredAt.slice(0, 10),
        e.description,
        EXPENSE_CATEGORY_LABEL[e.category] || e.category,
        reais(e.amountCents),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(despesaRows), "Despesas");
    const bytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resultado-${from}-${to}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([595.28, 841.89]);
    const gold = rgb(0.15, 0.45, 0.48);
    page.drawText(winAnsiSafe("Resultado operacional"), { x: 48, y: 800, size: 16, font: bold, color: gold });
    page.drawText(winAnsiSafe(staff.clinic.name), { x: 48, y: 780, size: 11, font: bold });
    page.drawText(winAnsiSafe(`Periodo ${from} a ${to}`), { x: 48, y: 762, size: 10, font });
    let y = 730;
    const line = (label: string, value: string, strong = false) => {
      page.drawText(winAnsiSafe(label), { x: 48, y, size: 10, font: strong ? bold : font });
      page.drawText(winAnsiSafe(value), { x: 320, y, size: 10, font: strong ? bold : font });
      y -= 16;
    };
    line("Receita bruta (consultas)", brl(result.receitaBrutaCents));
    line("Despesas", brl(result.despesaTotalCents));
    line("Resultado operacional", brl(result.resultadoCents), true);
    y -= 8;
    line("Parte da clinica", brl(result.clinicShareCents));
    line("Parte dos medicos", brl(result.doctorShareCents));
    y -= 12;
    page.drawText(winAnsiSafe("Despesas do periodo"), { x: 48, y, size: 11, font: bold, color: gold });
    y -= 16;
    for (const e of result.expenses.slice(0, 28)) {
      page.drawText(
        winAnsiSafe(`${e.occurredAt.slice(0, 10)}  ${e.description.slice(0, 40)}  ${brl(e.amountCents)}`).slice(0, 95),
        { x: 48, y, size: 8, font }
      );
      y -= 12;
      if (y < 50) break;
    }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="resultado-${from}-${to}.pdf"`,
      },
    });
  }
  return NextResponse.json(payload);
}
