import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getDoctorById } from "@/lib/store";
import { runAll, runTool } from "@/lib/calculators";
import { SECTION_LABEL } from "@/lib/calculators/catalog";
import { loadPatientCalcContext } from "@/lib/calculators/load-patient";
import {
  addAssessment,
  addDecision,
  appendCalcResult,
  listAssessments,
  listCalcHistory,
  listDecisions,
  syncToolCatalog,
} from "@/lib/calculators-store";
import type { ManualOverrides } from "@/lib/calculators/types";

export async function GET(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const loaded = await loadPatientCalcContext(email, doctorId);
  if (!loaded) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!loaded.access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const url = new URL(req.url);
  const toolId = url.searchParams.get("toolId");
  const history = url.searchParams.get("history") === "1";

  if (history) {
    const rows = await listCalcHistory({
      doctorId,
      patientKey: loaded.access.key,
      toolId: toolId || undefined,
      limit: 120,
    });
    const assessments = await listAssessments(doctorId, loaded.access.key, toolId || undefined);
    return NextResponse.json({ history: rows, assessments });
  }

  const { results, counts } = toolId
    ? { results: [runTool(toolId, loaded.ctx)], counts: { updated: 0, needData: 0, notApplicable: 0, needClinical: 0 } }
    : runAll(loaded.ctx);
  const decisions = await listDecisions(doctorId, loaded.access.key);
  const assessments = await listAssessments(doctorId, loaded.access.key);
  return NextResponse.json({
    patient: { name: loaded.access.name, key: loaded.access.key },
    results,
    counts: toolId ? undefined : counts,
    sections: SECTION_LABEL,
    decisions,
    assessments,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const loaded = await loadPatientCalcContext(email, doctorId);
  if (!loaded) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!loaded.access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "refresh");
  syncToolCatalog().catch(() => {});

  if (action === "refresh") {
    const { results, counts } = runAll(loaded.ctx);
    for (const r of results) {
      await appendCalcResult({
        doctorId,
        patientKey: loaded.access.key,
        toolId: r.toolId,
        status: r.status,
        headline: r.headline,
        result: r,
      });
    }
    return NextResponse.json({ results, counts, saved: results.length });
  }

  if (action === "compute") {
    const toolId = String(body.toolId || "").trim();
    if (!toolId) return NextResponse.json({ error: "Informe a calculadora." }, { status: 400 });
    const overrides = (body.overrides || {}) as ManualOverrides;
    const result = runTool(toolId, loaded.ctx, overrides);
    if (body.save) {
      await appendCalcResult({
        doctorId,
        patientKey: loaded.access.key,
        toolId: result.toolId,
        status: result.status,
        headline: result.headline,
        result,
      });
    }
    return NextResponse.json({ result });
  }

  if (action === "record") {
    const toolId = String(body.toolId || "").trim();
    if (!["cfs", "function_basic", "spict", "necpal", "pps"].includes(toolId)) {
      return NextResponse.json({ error: "Ferramenta de registro inválida." }, { status: 400 });
    }
    const doctor = await getDoctorById(doctorId);
    const assessment = await addAssessment({
      doctorId,
      patientKey: loaded.access.key,
      toolId,
      payload: (body.payload || {}) as Record<string, string | number | boolean | null>,
      assessedBy: body.assessedBy ? String(body.assessedBy) : doctor?.name || null,
      context: body.context ? String(body.context) : null,
      note: body.note ? String(body.note) : null,
    });
    const reloaded = await loadPatientCalcContext(email, doctorId);
    const result = reloaded ? runTool(toolId, reloaded.ctx) : null;
    if (result) {
      await appendCalcResult({
        doctorId,
        patientKey: loaded.access.key,
        toolId,
        status: result.status,
        headline: result.headline,
        result,
      });
    }
    return NextResponse.json({ assessment, result });
  }

  if (action === "decide") {
    const decision = await addDecision({
      doctorId,
      patientKey: loaded.access.key,
      toolId: String(body.toolId || "geriatric_med_review"),
      item: String(body.item || ""),
      rule: String(body.rule || ""),
      decision: String(body.decision || "revisar"),
      note: body.note ? String(body.note) : null,
    });
    return NextResponse.json({ decision });
  }

  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
