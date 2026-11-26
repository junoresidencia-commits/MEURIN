import { NextResponse } from "next/server";
import { isReturnProfessionalKind } from "@/lib/return-request-types";
import { loadPublicProfessional, listReturnSlots, listConsultSlots, findLastVisit, patientKnownToProfessional } from "@/lib/return-request-flow";
import { getPatientEmail } from "@/lib/patient-session";
import { daysBetween, habitualWindow } from "@/lib/return-request-types";

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!isReturnProfessionalKind(kind)) return NextResponse.json({ error: "Profissional inválido." }, { status: 400 });
  const pro = await loadPublicProfessional(kind, id);
  if (!pro) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });
  const url = new URL(req.url);
  const visit = url.searchParams.get("visit") === "retorno" ? "retorno" : "consulta";
  const slots = visit === "retorno" ? await listReturnSlots(kind, id) : await listConsultSlots(kind, id);
  const email = await getPatientEmail();
  let lastVisit: { at: string; days: number; within: boolean; label: string } | null = null;
  let knownPatient = false;
  if (email) {
    const found = await findLastVisit({ kind, professionalId: id, patientEmail: email, patientKey: email });
    if (found) {
      const days = daysBetween(found.at, new Date().toISOString());
      const w = habitualWindow(days);
      lastVisit = { at: found.at, days, within: w.within, label: w.label };
    }
    knownPatient = Boolean(found) || await patientKnownToProfessional({
      kind, professionalId: id, patientEmail: email, patientKey: email,
    });
  }
  return NextResponse.json({ professional: pro, slots, lastVisit, knownPatient });
}
