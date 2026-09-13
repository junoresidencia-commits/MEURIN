import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { listEncounters, productionSummary } from "@/lib/clinic-finance-store";
import { readDb } from "@/lib/store";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const doctorId = url.searchParams.get("doctorId") || undefined;
  let encounters = await listEncounters(id, from, to ? `${to}T23:59:59.999Z` : undefined);
  if (doctorId) encounters = encounters.filter((e) => e.doctorId === doctorId);
  const db = await readDb();
  const named = encounters.map((e) => ({
    ...e,
    doctorName: db.doctors.find((d) => d.id === e.doctorId)?.name || "Médico",
  }));
  const summary = productionSummary(encounters);
  return NextResponse.json({
    encounters: named,
    summary: {
      ...summary,
      byDoctor: summary.byDoctor.map((row) => ({
        ...row,
        doctorName: db.doctors.find((d) => d.id === row.doctorId)?.name || "Médico",
      })),
    },
  });
}
