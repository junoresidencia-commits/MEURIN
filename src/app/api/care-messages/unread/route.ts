import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/nutrition-context";
import { requireAllied } from "@/lib/allied-access";
import { unreadCareCountsForProfessional } from "@/lib/care-messages-store";

export async function GET() {
  const nut = await requireNutritionist();
  if (nut) {
    const counts = await unreadCareCountsForProfessional(nut.id);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ counts, total });
  }
  const pro = await requireAllied();
  if (pro) {
    const counts = await unreadCareCountsForProfessional(pro.id);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({ counts, total });
  }
  return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
}
