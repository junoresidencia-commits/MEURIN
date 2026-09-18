import { NextResponse } from "next/server";
import { requireClinicCashPerm } from "@/lib/platform-access";
import { closeCashDay, getCashSessionByDay, listCashSessions, cashFlow } from "@/lib/clinic-cash-store";
import { writeAudit } from "@/lib/platform-store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "finance_view");
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const day = (url.searchParams.get("day") || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const [sessions, existing, flow] = await Promise.all([
    listCashSessions(id),
    getCashSessionByDay(id, day),
    cashFlow(id, { from: day, to: day }),
  ]);
  const previous = sessions.filter((s) => s.day < day).sort((a, b) => b.day.localeCompare(a.day))[0];
  const openingCents = previous?.countedCents ?? 0;
  const cashIn = flow.byMethod.dinheiro.inCents;
  const cashOut = flow.expenses
    .filter((e) => e.origin === "caixa_fisico" || e.method === "dinheiro")
    .reduce((s, e) => s + e.amountCents, 0);
  return NextResponse.json({
    day,
    session: existing,
    sessions,
    preview: {
      openingCents,
      inCents: cashIn,
      outCents: cashOut,
      expectedCents: openingCents + cashIn - cashOut,
      byMethod: flow.byMethod,
      inTotalCents: flow.inCents,
      outTotalCents: flow.outCents,
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicCashPerm(id, "close_cash");
  if (!staff) return NextResponse.json({ error: "Sem permissão para fechar o caixa." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const counted =
      body.counted != null ? Math.round(Number(String(body.counted).replace(",", ".")) * 100) : Math.round(Number(body.countedCents || 0));
    const session = await closeCashDay({
      clinicId: id,
      day: body.day ? String(body.day) : undefined,
      countedCents: counted,
      justification: body.justification ? String(body.justification) : undefined,
      closedByKind: staff.kind,
      closedById: staff.actorId,
      closedByName: staff.name,
      closedByEmail: staff.email,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "clinic_cash_close",
      entity: "clinic_cash_session",
      entityId: session.id,
      detail: `${staff.clinic.name} · ${session.day} · esperado ${session.expectedCents} · contado ${session.countedCents} · dif ${session.differenceCents}`,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível fechar o caixa." }, { status: 400 });
  }
}
