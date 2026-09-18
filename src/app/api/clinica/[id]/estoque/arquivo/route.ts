import { NextResponse } from "next/server";
import { requireClinicStockPerm } from "@/lib/platform-access";
import { getStockMove } from "@/lib/clinic-stock-store";
import { CLINIC_CASH_BUCKET, CLINIC_STOCK_BUCKET, readFile } from "@/lib/doc-storage";
import { getExpense } from "@/lib/clinic-cash-store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicStockPerm(id, "stock_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const moveId = url.searchParams.get("moveId") || "";
  const move = await getStockMove(moveId);
  if (!move || move.clinicId !== id) return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });
  if (move.expenseId) {
    const expense = await getExpense(move.expenseId);
    if (expense?.attachmentPath && expense.attachmentStorage) {
      const file = await readFile(CLINIC_CASH_BUCKET, expense.attachmentStorage, expense.attachmentPath);
      if (file) {
        return new NextResponse(new Uint8Array(file.buffer), {
          headers: {
            "Content-Type": expense.attachmentMime || file.mime,
            "Content-Disposition": `inline; filename="${expense.attachmentName || "comprovante"}"`,
          },
        });
      }
    }
  }
  if (!move.attachmentPath || !move.attachmentStorage) {
    return NextResponse.json({ error: "Esta compra não tem comprovante." }, { status: 404 });
  }
  const file = await readFile(CLINIC_STOCK_BUCKET, move.attachmentStorage, move.attachmentPath);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename="${move.attachmentName || "comprovante"}"`,
    },
  });
}
