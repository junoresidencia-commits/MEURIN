import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { createClosing, listAdjustments, listClosings, netDoctorPayout } from "@/lib/clinic-closing-store";
import { writeAudit } from "@/lib/platform-store";
import { readDb } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const closings = await listClosings(id);
  const db = await readDb();
  const rows = await Promise.all(
    closings.map(async (c) => {
      const adjustments = await listAdjustments(c.id);
      return {
        ...c,
        doctorName: db.doctors.find((d) => d.id === c.doctorId)?.name || "Médico",
        netCents: netDoctorPayout(c, adjustments),
        adjustmentCount: adjustments.length,
      };
    })
  );
  return NextResponse.json({ closings: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const closing = await createClosing({
      clinicId: id,
      doctorId: String(body.doctorId || ""),
      periodFrom: String(body.periodFrom || ""),
      periodTo: String(body.periodTo || ""),
      createdBy: staff.actorId,
    });
    await writeAudit({
      actorKind: staff.kind,
      actorId: staff.actorId,
      actorEmail: staff.email,
      action: "create_closing",
      entity: "clinic_closing",
      entityId: closing.id,
      detail: closing.code,
    });
    return NextResponse.json({ closing }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível fechar." }, { status: 400 });
  }
}
