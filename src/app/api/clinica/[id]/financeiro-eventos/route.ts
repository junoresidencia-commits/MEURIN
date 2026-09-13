import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listFinanceEvents } from "@/lib/clinic-finance-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const events = await listFinanceEvents(id, 50);
  return NextResponse.json({ events });
}
