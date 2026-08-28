import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { listAlliedReferralsForPatient, listNotesForPatient, ROLE_META, isAlliedRole } from "@/lib/allied-store";
import { listConsultationsForPatient, listReferralsForPatient } from "@/lib/nutritionists-store";
import { listPdDailyLogs, listPdCatheterEvals, listPdPeritonitis } from "@/lib/pd-store";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolvePatientAccess(decodeURIComponent((await params).email));
  if (!access?.allowed) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const [alliedNotes, alliedRefs, nutRefs, nutConsults, pdLogs, pdCatheter, pdPeri] = await Promise.all([
    listNotesForPatient(access.key),
    listAlliedReferralsForPatient(access.key),
    listReferralsForPatient(access.key),
    listConsultationsForPatient(access.key),
    listPdDailyLogs(access.key),
    listPdCatheterEvals(access.key),
    listPdPeritonitis(access.key),
  ]);

  type Ev = { at: string; area: string; label: string; by?: string | null; detail?: string | null; id: string };
  const events: Ev[] = [];

  for (const n of alliedNotes) {
    const shared = n.role !== "psychology" || n.shareWithTeam;
    const area = isAlliedRole(n.role) ? ROLE_META[n.role].label : n.role;
    events.push({
      at: n.createdAt,
      area,
      label: n.kind === "anamnese" ? "Anamnese registrada" : n.kind === "avaliacao" ? "Avaliação registrada" : "Evolução registrada",
      by: n.professionalName,
      detail: shared ? n.body : "Atendimento realizado (conteúdo restrito à psicologia).",
      id: n.id,
    });
  }
  for (const r of alliedRefs) {
    const area = isAlliedRole(r.role) ? ROLE_META[r.role].label : r.role;
    events.push({ at: r.createdAt, area, label: "Paciente encaminhado", by: r.doctorName, detail: r.reason, id: r.id });
  }
  for (const r of nutRefs) {
    events.push({ at: r.createdAt, area: "Nutrição", label: "Encaminhamento nutricional", by: r.doctorName, detail: r.reason, id: r.id });
  }
  for (const c of nutConsults) {
    events.push({ at: c.createdAt, area: "Nutrição", label: "Avaliação nutricional realizada", by: c.nutritionistName, detail: null, id: c.id });
  }
  for (const l of pdLogs.slice(0, 20)) {
    events.push({ at: l.createdAt, area: "DP", label: "Controle de enfermagem registrado", by: l.createdByName, detail: l.events, id: l.id });
  }
  for (const c of pdCatheter.slice(0, 10)) {
    events.push({ at: c.createdAt, area: "DP", label: "Avaliação do cateter", by: c.createdByName, detail: c.notes, id: c.id });
  }
  for (const p of pdPeri) {
    events.push({ at: p.createdAt, area: "DP", label: "Episódio de peritonite", by: p.createdByName, detail: p.organism || p.symptoms, id: p.id });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ events: events.slice(0, 80) });
}
