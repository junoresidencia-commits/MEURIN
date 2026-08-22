import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { clinicalKey, listPatientsByDoctor } from "@/lib/patients-store";
import { getLatestLabsByEmails, getRecentLabsByEmails } from "@/lib/patient-store";
import { listOpenAttendance, listReturnsByDoctor } from "@/lib/care-store";
import { listLmeByDoctor } from "@/lib/lme-store";
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
  const pendingReturns = returns.filter((r) => !futureByPatient.has(r.patientKey.toLowerCase()));
  const retornosAtrasados = pendingReturns.filter((r) => new Date(r.dueAt).getTime() < now).length;
  const retornosPendentes = pendingReturns.filter((r) => new Date(r.dueAt).getTime() <= in7).length;

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

  // Alertas clínicos agregados (últimos exames de todos os pacientes, em lote).
  const latestByKey = await getLatestLabsByEmails(allKeys);
  const alertas: { patientKey: string; patientName: string; level: "urgente" | "importante"; text: string; date: string }[] = [];
  for (const [key, labs] of latestByKey.entries()) {
    const name = nameByKey.get(key) || key;
    const k = labs.get("potassio");
    const tfge = labs.get("tfge") || labs.get("tfge_cistatina");
    const hb = labs.get("hemoglobina");
    if (k && k.value >= 6.0) alertas.push({ patientKey: key, patientName: name, level: "urgente", text: `Potássio ${k.value} mEq/L (hipercalemia grave)`, date: k.measuredAt });
    else if (tfge && tfge.value < 15) alertas.push({ patientKey: key, patientName: name, level: "urgente", text: `TFGe ${tfge.value} mL/min/1,73m²`, date: tfge.measuredAt });
    else if (k && k.value >= 5.5) alertas.push({ patientKey: key, patientName: name, level: "importante", text: `Potássio ${k.value} mEq/L (hipercalemia)`, date: k.measuredAt });
    else if (k && k.value <= 3.0) alertas.push({ patientKey: key, patientName: name, level: "importante", text: `Potássio ${k.value} mEq/L (hipocalemia)`, date: k.measuredAt });
    else if (hb && hb.value < 8) alertas.push({ patientKey: key, patientName: name, level: "importante", text: `Hemoglobina ${hb.value} g/dL (anemia importante)`, date: hb.measuredAt });
  }
  alertas.sort((a, b) => (a.level === b.level ? b.date.localeCompare(a.date) : a.level === "urgente" ? -1 : 1));

  // LME para assinar (criadas por este médico e ainda não assinadas).
  const lmeList = await listLmeByDoctor(doctorId).catch(() => []);
  const lmeParaAssinar = lmeList.filter((l) => !l.signedAt).length;

  // Continuar de onde parou (atendimento em andamento mais recente).
  const open = await listOpenAttendance(doctorId);
  const continuar = open[0]
    ? { patientKey: open[0].patientKey, patientName: open[0].patientName || nameByKey.get(open[0].patientKey) || open[0].patientKey, startedAt: open[0].startedAt }
    : null;

  // Resumo da clínica — últimos 7 dias vs. 7 dias anteriores (variação real).
  const d7 = 7 * 86400000;
  const last7Start = now - d7;
  const prev7Start = now - 2 * d7;
  const inLast = (ts: number) => ts >= last7Start && ts <= now;
  const inPrev = (ts: number) => ts >= prev7Start && ts < last7Start;
  const delta = (a: number, b: number): number | null => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : null);
  const pair = (last: number, prev: number) => ({ v: last, delta: delta(last, prev) });

  const mine = db.bookings.filter((b) => b.doctorId === doctorId);
  const isDone = (b: (typeof mine)[number]) => b.status === "completed" || b.stage === "realizada";
  const doneLast = mine.filter((b) => isDone(b) && inLast(new Date(b.slotStart).getTime()));
  const donePrev = mine.filter((b) => isDone(b) && inPrev(new Date(b.slotStart).getTime()));
  const isRetorno = (b: (typeof mine)[number]) => b.careReason === "acompanhamento";
  const revenue = (list: typeof mine) => list.filter((b) => ["paid", "confirmed", "completed"].includes(b.status)).reduce((s, b) => s + Math.round(b.priceCents * 0.95), 0);
  const paidTs = (b: (typeof mine)[number]) => new Date(b.paidAt || b.slotStart).getTime();

  const patsLast = created.filter((p) => inLast(new Date(p.createdAt).getTime())).length;
  const patsPrev = created.filter((p) => inPrev(new Date(p.createdAt).getTime())).length;

  const labs14 = await getRecentLabsByEmails(allKeys, prev7Start, 2000);
  const examesLast = labs14.filter((l) => inLast(new Date(l.createdAt).getTime())).length;
  const examesPrev = labs14.filter((l) => inPrev(new Date(l.createdAt).getTime())).length;

  const lmeLast = lmeList.filter((l) => inLast(new Date(l.createdAt).getTime())).length;
  const lmePrev = lmeList.filter((l) => inPrev(new Date(l.createdAt).getTime())).length;

  const resumo = {
    consultasRealizadas: pair(doneLast.length, donePrev.length),
    novosPacientes: pair(patsLast, patsPrev),
    retornosRealizados: pair(doneLast.filter(isRetorno).length, donePrev.filter(isRetorno).length),
    examesImportados: pair(examesLast, examesPrev),
    lmeEmitidas: pair(lmeLast, lmePrev),
    receitaCents: pair(
      revenue(mine.filter((b) => inLast(paidTs(b)))),
      revenue(mine.filter((b) => inPrev(paidTs(b))))
    ),
  };

  // Pendências acionáveis (sem inventar — só o que existe).
  const pendencias: { label: string; count: number; href: string }[] = [];
  if (retornosPendentes > 0) pendencias.push({ label: retornosPendentes === 1 ? "Retorno para organizar" : "Retornos para organizar", count: retornosPendentes, href: "/medicos/retornos" });
  if (lmeParaAssinar > 0) pendencias.push({ label: "LME para assinar", count: lmeParaAssinar, href: "/medicos/lme" });
  if (aguardando > 0) pendencias.push({ label: aguardando === 1 ? "Consulta aguardando confirmação" : "Consultas aguardando confirmação", count: aguardando, href: "/medicos/agenda" });

  return NextResponse.json({
    counts: {
      pacientes: nameByKey.size,
      consultasHoje,
      retornosPendentes,
      retornosAtrasados,
      novosExames: examesLast,
      alertas: alertas.length,
      lmeParaAssinar,
      aguardando,
      pendencias: pendencias.reduce((s, p) => s + p.count, 0),
    },
    continuar,
    recentExams,
    alertas: alertas.slice(0, 12),
    pendencias,
    resumo,
  });
}
