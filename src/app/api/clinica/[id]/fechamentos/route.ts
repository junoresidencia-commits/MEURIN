import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { createClosing, listAdjustments, listClosings, netDoctorPayout, previewClosing } from "@/lib/clinic-closing-store";
import { writeAudit } from "@/lib/platform-store";
import { listDoctors } from "@/lib/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get("preview") === "1") {
    try {
      const preview = await previewClosing({
        clinicId: id,
        doctorId: String(url.searchParams.get("doctorId") || ""),
        periodFrom: String(url.searchParams.get("periodFrom") || ""),
        periodTo: String(url.searchParams.get("periodTo") || ""),
      });
      return NextResponse.json({ preview });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível conferir." }, { status: 400 });
    }
  }
  const closings = await listClosings(id);
  const doctors = await listDoctors();
  const rows = await Promise.all(
    closings.map(async (c) => {
      const adjustments = await listAdjustments(c.id);
      return {
        ...c,
        doctorName: doctors.find((d) => d.id === c.doctorId)?.name || "Médico",
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
    const msg = e instanceof Error ? e.message : "Não foi possível fechar.";
    const existing = msg.includes("Já existe um fechamento");
    return NextResponse.json({ error: msg, existing: existing || undefined }, { status: existing ? 409 : 400 });
  }
}
