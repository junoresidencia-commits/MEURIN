import { NextResponse } from "next/server";
import { requireAllied } from "@/lib/allied-access";
import { getDoctorById } from "@/lib/store";
import { listActiveDoctorIdsForProfessional } from "@/lib/allied-store";

export async function GET() {
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const doctorIds = await listActiveDoctorIdsForProfessional(pro.id);
  const doctors = [];
  for (const id of doctorIds) {
    const d = await getDoctorById(id);
    if (d) doctors.push({ id: d.id, name: d.name });
  }
  const { passwordHash, ...safe } = pro;
  void passwordHash;
  return NextResponse.json({ professional: safe, doctors });
}
