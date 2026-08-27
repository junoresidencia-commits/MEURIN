import { NextRequest, NextResponse } from "next/server";
import { resolvePdWriteAccess, isPdClinicalPatient } from "@/lib/pd-access";
import {
  addPdAdequacy, addPdCatheterEval, addPdDailyLog, addPdPeritonitis, addPdPrescription, addPdTraining,
  type PdTrainingStatus,
} from "@/lib/pd-store";

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ patientKey: string }> }) {
  const { patientKey } = await params;
  const actor = await resolvePdWriteAccess(patientKey);
  if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (!(await isPdClinicalPatient(actor.key))) {
    return NextResponse.json({ error: "Paciente não está em diálise peritoneal." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "");
  const stamp = { createdBy: actor.actorId, createdByName: actor.actorName };
  const today = new Date().toISOString().slice(0, 10);

  if (kind === "prescription") {
    const exchanges = num(body.exchangesPerDay ?? body.exchanges) ?? 0;
    const volume = num(body.volumeMl) ?? 0;
    const rec = await addPdPrescription({
      patientKey: actor.key,
      exchanges,
      volumeMl: volume,
      dwellHours: num(body.dwellHours),
      solution: String(body.solution || ""),
      glucosePercent: String(body.glucoseConcentration || body.glucosePercent || ""),
      icodextrin: Boolean(body.icodextrin),
      totalDailyMl: num(body.totalDailyVolumeMl ?? body.totalDailyMl) ?? (exchanges * volume || null),
      lastFill: String(body.lastFill || ""),
      notes: String(body.notes || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  if (kind === "daily") {
    const rec = await addPdDailyLog({
      patientKey: actor.key,
      loggedAt: String(body.date || body.loggedAt || new Date().toISOString()),
      weightKg: num(body.weightKg),
      systolic: num(body.systolic),
      diastolic: num(body.diastolic),
      urineMl: num(body.urineMl),
      ultrafiltrationMl: num(body.ultrafiltrationMl),
      drainedMl: num(body.drainedVolumeMl ?? body.drainedMl),
      balanceMl: num(body.balanceMl),
      edema: String(body.edema || ""),
      glucoseMgDl: num(body.glucose ?? body.glucoseMgDl),
      effluent: String(body.effluentAppearance || body.effluent || "claro"),
      abdominalPain: Boolean(body.abdominalPain),
      fever: Boolean(body.fever),
      missedExchanges: Boolean(body.missedExchanges),
      events: String(body.occurrences || body.events || body.notes || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  if (kind === "catheter") {
    const rec = await addPdCatheterEval({
      patientKey: actor.key,
      evaluatedAt: String(body.date || body.evaluatedAt || today),
      site: String(body.site || ""),
      orifice: String(body.exitSite || body.orifice || ""),
      hyperemia: Boolean(body.hyperemia),
      secretion: Boolean(body.secretion),
      pain: Boolean(body.pain),
      crust: Boolean(body.crust),
      dressing: String(body.dressing || ""),
      notes: String(body.notes || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  if (kind === "peritonitis") {
    const rec = await addPdPeritonitis({
      patientKey: actor.key,
      onsetDate: String(body.date || body.onsetDate || today),
      symptoms: String(body.symptoms || ""),
      cloudyEffluent: Boolean(body.cloudyEffluent),
      abdominalPain: Boolean(body.abdominalPain),
      cellCount: String(body.cellCount || ""),
      pmn: String(body.pmn || ""),
      gram: String(body.gram || ""),
      culture: String(body.culture || ""),
      organism: String(body.organism || ""),
      antibiotic: String(body.antibiotic || ""),
      route: String(body.route || ""),
      startDate: String(body.startDate || ""),
      endDate: String(body.endDate || ""),
      clinicalResponse: String(body.clinicalResponse || ""),
      catheterRemoved: Boolean(body.catheterRemoved),
      recurrenceKind: String(body.recurrenceKind || ""),
      outcome: String(body.outcome || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  if (kind === "adequacy") {
    const rec = await addPdAdequacy({
      patientKey: actor.key,
      measuredAt: String(body.date || body.measuredAt || today),
      ktv: num(body.ktv),
      residualClearance: num(body.residualClearance),
      residualUrineMl: num(body.residualUrine || body.residualUrineMl),
      ultrafiltrationMl: num(body.ultrafiltration || body.ultrafiltrationMl),
      pet: String(body.pet || ""),
      transporter: String(body.transporterType || body.transporter || ""),
      notes: String(body.notes || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  if (kind === "training") {
    const items = (body.items && typeof body.items === "object" && !Array.isArray(body.items)
      ? body.items
      : {}) as Record<string, PdTrainingStatus>;
    const rec = await addPdTraining({
      patientKey: actor.key,
      evaluatedAt: String(body.date || body.evaluatedAt || today),
      items,
      notes: String(body.notes || ""),
      ...stamp,
    });
    return NextResponse.json({ ok: true, record: rec });
  }

  return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
}
