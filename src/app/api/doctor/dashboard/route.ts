import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";
import { getRecentLabsByEmails } from "@/lib/patient-store";
import { listOpenAttendance, listReturnsByDoctor } from "@/lib/care-store";
import { NEPHRO_LABS } from "@/lib/labs";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const db = await readDb();
  const created = (await listPatientsByDoctor(doctorId)).filter((p) => p.status !== "archived");
  const createdEmails = new Set(created.map((p) => (p.email || "").toLowerCase()).filter(Boolean));

  // Nome por chave clínica (para exames recentes).
  const nameByKey = new Map<string, string>();
  const allKeys: string[] = [];
  for (const p of created) { const k = clinicalKey(p); nameByKey.set(k, p.name); allKeys.push(k); }
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId) continue;
    const e = b.patientEmail.toLowerCase();
    if (createdEmails.has(e)) continue;
    if (!nameByKey.has(e)) { nameByKey.set(e, b.patientName); allKeys.push(e); }
  }

  const now = Date.now();
  const todayStr = new Date().toDateString();
  const consultasHoje = db.bookings.filter((b) => b.doctorId === doctorId && b.status !== "cancelled" && new Date(b.slotStart).toDateString() === todayStr).length;
  // Consultas aguardando ação (pagas aguardando confirmação ou horário proposto).
  const aguardando = db.bookings.filter((b) => b.doctorId === doctorId && (b.status === "paid" || b.stage === "proposto_novo_horario")).length;

  // Retornos pendentes (abertos, vencidos/próx. 7 dias, sem consulta futura).
  const returns = await listReturnsByDoctor(doctorId, "open");
  const futureByPatient = new Set<string>();
  for (const b of db.bookings) {
    if (b.doctorId !== doctorId || b.status === "cancelled") continue;
    if (new Date(b.slotStart).getTime() > now) futureByPatient.add(b.patientEmail.toLowerCase());
  }
  const in7 = now + 7 * 86400000;
  const retornosPendentes = returns.filter((r) => !futureByPatient.has(r.patientKey.toLowerCase()) && new Date(r.dueAt).getTime() <= in7).length;

  // Novos exames (importados nos últimos 7 dias).
  const labelByKey = new Map(NEPHRO_LABS.map((l) => [l.key, l.label]));
  const recentLabs = await getRecentLabsByEmails(allKeys, now - 7 * 86400000, 20);
  const recentExams = recentLabs.map((l) => ({
    patientKey: l.patientEmail,
    patientName: nameByKey.get(l.patientEmail) || l.patientEmail,
    testKey: l.testKey,
    testLabel: labelByKey.get(l.testKey) || l.testKey,
    value: l.value,
    unit: l.unit,
    measuredAt: l.measuredAt,
    createdAt: l.createdAt,
  }));

  // Continuar de onde parou (atendimento em andamento mais recente).
  const open = await listOpenAttendance(doctorId);
  const continuar = open[0]
    ? { patientKey: open[0].patientKey, patientName: open[0].patientName || nameByKey.get(open[0].patientKey) || open[0].patientKey, startedAt: open[0].startedAt }
    : null;

  // Pendências acionáveis (sem inventar — só o que existe).
  const pendencias: { label: string; count: number; href: string }[] = [];
  if (retornosPendentes > 0) pendencias.push({ label: "Retornos para organizar", count: retornosPendentes, href: "/medicos/retornos" });
  if (aguardando > 0) pendencias.push({ label: "Consultas aguardando confirmação", count: aguardando, href: "/medicos/agenda" });

  return NextResponse.json({
    counts: {
      pacientes: nameByKey.size,
      consultasHoje,
      retornosPendentes,
      novosExames: recentExams.length,
      aguardando,
      pendencias: pendencias.reduce((s, p) => s + p.count, 0),
    },
    continuar,
    recentExams,
    pendencias,
  });
}
