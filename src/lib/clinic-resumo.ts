import "server-only";
import { listClosings } from "./clinic-closing-store";
import { listEncounters, listFeeRules, productionSummary } from "./clinic-finance-store";
import { listMemberships } from "./platform-store";

export type ClinicAlert = {
  tone: "red" | "yellow" | "green";
  text: string;
};

export async function clinicExecutiveResumo(clinicId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthFrom = `${today.slice(0, 7)}-01`;
  const [todayEnc, monthEnc, closings, rules, memberships] = await Promise.all([
    listEncounters(clinicId, `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`),
    listEncounters(clinicId, `${monthFrom}T00:00:00.000Z`),
    listClosings(clinicId),
    listFeeRules(clinicId),
    listMemberships(clinicId),
  ]);

  const todaySum = productionSummary(todayEnc);
  const monthSum = productionSummary(monthEnc);
  const doctors = memberships.filter((m) => m.actorKind === "doctor" && m.status === "active");
  const doctorIds = [...new Set(doctors.map((m) => m.actorId))];
  const missingFee = doctorIds.filter((id) => !rules.some((r) => r.doctorId === id));
  const pendingPay = monthEnc.filter((e) => e.paymentStatus === "pending" || e.paymentStatus === "partial");
  const zeroFee = monthEnc.filter((e) => e.feeCents <= 0);
  const unpaidClosings = closings.filter((c) => c.status !== "paid");
  const overdue = unpaidClosings.filter((c) => Date.now() - new Date(c.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000);
  const closedDoctorIds = new Set(
    closings
      .filter((c) => c.periodFrom <= today && c.periodTo >= monthFrom)
      .map((c) => c.doctorId)
  );
  const waitingClose = monthSum.byDoctor.filter((d) => d.count > 0 && !closedDoctorIds.has(d.doctorId));

  const alerts: ClinicAlert[] = [];
  if (pendingPay.length) alerts.push({ tone: "red", text: `${pendingPay.length} pagamento(s) pendente(s)` });
  if (waitingClose.length) alerts.push({ tone: "yellow", text: `${waitingClose.length} médico(s) aguardando fechamento` });
  if (overdue.length) alerts.push({ tone: "yellow", text: `${overdue.length} repasse(s) atrasado(s)` });
  if (zeroFee.length || missingFee.length) {
    alerts.push({
      tone: "red",
      text: `${zeroFee.length + missingFee.length} consulta(s)/médico(s) sem valor configurado`,
    });
  }
  if (alerts.length === 0) alerts.push({ tone: "green", text: "Sistema funcionando normalmente." });

  return {
    today: {
      encounters: todaySum.count,
      receivedCents: todaySum.receivedCents,
      pendingCents: todaySum.pendingCents,
      producedCents: todaySum.producedCents,
    },
    month: {
      encounters: monthSum.count,
      producedCents: monthSum.producedCents,
      receivedCents: monthSum.receivedCents,
      pendingCents: monthSum.pendingCents,
      toPayoutCents: unpaidClosings.reduce((s, c) => s + c.doctorShareCents, 0),
    },
    doctorsToday: todaySum.byDoctor.map((d) => d.doctorId),
    unpaidClosings: unpaidClosings.length,
    alerts,
  };
}
