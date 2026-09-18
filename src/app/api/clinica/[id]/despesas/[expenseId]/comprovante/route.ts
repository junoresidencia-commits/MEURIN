import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import { getExpense } from "@/lib/clinic-cash-store";
import { CLINIC_CASH_BUCKET, readFile } from "@/lib/doc-storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const { id, expenseId } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const expense = await getExpense(expenseId);
  if (!expense || expense.clinicId !== id) return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });
  if (!expense.attachmentPath || !expense.attachmentStorage) {
    return NextResponse.json({ error: "Esta despesa não tem comprovante." }, { status: 404 });
  }
  const file = await readFile(CLINIC_CASH_BUCKET, expense.attachmentStorage, expense.attachmentPath);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": expense.attachmentMime || file.mime,
      "Content-Disposition": `inline; filename="${expense.attachmentName || "comprovante"}"`,
    },
  });
}
