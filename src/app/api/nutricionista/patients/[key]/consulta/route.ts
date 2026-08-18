import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireNutritionist, resolveNutritionPatientAccess } from "@/lib/nutrition-context";
import { addConsultation, setReferralStatus } from "@/lib/nutritionists-store";
import { addDocument } from "@/lib/patient-store";
import { DOCPDF_BUCKET, saveFile } from "@/lib/doc-storage";
import { buildDocumentPdf } from "@/lib/document-engine";
import type { LetterheadArea } from "@/lib/letterheads-store";

export const maxDuration = 60;

type PlanItem = { food?: string; grams?: number | string; household?: string; note?: string };
type Meal = { name?: string; time?: string; items?: PlanItem[] };
type Plan = { meals?: Meal[]; waterMl?: number | string; notes?: string; validUntil?: string; totals?: Record<string, number> };
type Assessment = Record<string, unknown>;

function composePlanText(plan: Plan, assessment: Assessment, patientName: string): string {
  const lines: string[] = [];
  lines.push(`PLANO ALIMENTAR INDIVIDUALIZADO`);
  lines.push(`Paciente: ${patientName}`);
  lines.push("");
  const a = assessment as Record<string, string | number | undefined>;
  const clin: string[] = [];
  if (a.diagnostico) clin.push(`Diagnóstico nutricional: ${a.diagnostico}`);
  if (a.pesoAtual) clin.push(`Peso atual: ${a.pesoAtual} kg`);
  if (a.altura) clin.push(`Altura: ${a.altura} cm`);
  if (a.imc) clin.push(`IMC: ${a.imc}`);
  if (a.metas) clin.push(`Metas: ${a.metas}`);
  if (clin.length) { lines.push(...clin); lines.push(""); }

  for (const meal of plan.meals || []) {
    const title = [meal.time, meal.name].filter(Boolean).join(" — ");
    if (title) lines.push(`**${title}**`);
    for (const it of meal.items || []) {
      const parts = [it.food, it.grams ? `${it.grams} g` : "", it.household ? `(${it.household})` : "", it.note ? `— ${it.note}` : ""].filter(Boolean);
      if (parts.length) lines.push(`• ${parts.join(" ")}`);
    }
    lines.push("");
  }
  if (plan.waterMl) lines.push(`Meta de líquidos: ${plan.waterMl} mL/dia`);
  if (plan.totals && Object.keys(plan.totals).length) {
    const t = plan.totals;
    const fmt: string[] = [];
    if (t.kcal) fmt.push(`${t.kcal} kcal`);
    if (t.protein_g) fmt.push(`Proteína ${t.protein_g} g`);
    if (t.sodium_mg) fmt.push(`Sódio ${t.sodium_mg} mg`);
    if (t.potassium_mg) fmt.push(`Potássio ${t.potassium_mg} mg`);
    if (t.phosphorus_mg) fmt.push(`Fósforo ${t.phosphorus_mg} mg`);
    if (fmt.length) lines.push(`Estimativa diária (aproximada): ${fmt.join(" · ")}`);
  }
  if (plan.notes) { lines.push(""); lines.push(`Observações: ${plan.notes}`); }
  if (plan.validUntil) { lines.push(""); lines.push(`Validade / revisão: ${plan.validUntil}`); }
  lines.push("");
  lines.push(`Valores nutricionais são estimativas. Ajustes devem ser feitos com sua nutricionista.`);
  return lines.join("\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const nut = await requireNutritionist();
  if (!nut) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { key } = await params;
  const patientKey = decodeURIComponent(key);
  const access = await resolveNutritionPatientAccess(patientKey);
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  try {
    const b = await req.json().catch(() => ({}));
    const assessment: Assessment = (b.assessment && typeof b.assessment === "object") ? b.assessment : {};
    const plan: Plan = (b.plan && typeof b.plan === "object") ? b.plan : {};
    const share = b.shareWithPatient === true;
    const generatePlanPdf = b.generatePlanPdf !== false; // por padrão gera o plano em PDF

    let documentId: string | null = null;
    if (generatePlanPdf) {
      const area: LetterheadArea = { marginTop: 0.08, marginBottom: 0.1, marginLeft: 0.1, marginRight: 0.1, repeat: "all", showPatientHeader: true, showSignature: true };
      const content = composePlanText(plan, assessment, access.name);
      const pdfBytes = await buildDocumentPdf({
        title: "Plano alimentar",
        content,
        patient: { name: access.name },
        doctor: { name: nut.name, crm: nut.crn ? `CRN ${nut.crn}${nut.uf ? "-" + nut.uf : ""}` : "", specialty: nut.specialty || "Nutrição" },
        area,
        background: null,
      });
      const saved = await saveFile(DOCPDF_BUCKET, nut.id, { name: "plano-alimentar.pdf", type: "application/pdf", buffer: Buffer.from(pdfBytes) });
      const now = new Date().toISOString();
      const doc = await addDocument({
        patientEmail: access.key,
        doctorId: nut.id,
        doctorName: nut.name,
        doctorCrm: nut.crn ? `CRN ${nut.crn}${nut.uf ? "-" + nut.uf : ""}` : undefined,
        type: "plano_alimentar",
        title: "Plano alimentar",
        body: content,
        sharedWithPatient: share,
        pdfPath: saved.path,
        pdfStorage: saved.storage,
        status: "final",
        version: 1,
        groupId: uuid(),
        history: [{ at: now, by: nut.name, action: "criado", detail: "Plano alimentar gerado pela nutricionista." }],
      });
      documentId = doc.id;
    }

    const consultation = await addConsultation({
      nutritionistId: nut.id,
      nutritionistName: nut.name,
      doctorId: access.doctorId,
      patientKey: access.key,
      patientName: access.name,
      assessment,
      plan,
      sharedWithPatient: share,
      documentId,
    });

    if (b.referralId) {
      try { await setReferralStatus(String(b.referralId), "atendido"); } catch { /* ok */ }
    }

    return NextResponse.json({ ok: true, consultation, documentId, pdfUrl: documentId ? `/api/documents/${documentId}/pdf` : null }, { status: 201 });
  } catch (err) {
    console.error("nutricionista/consulta", err);
    return NextResponse.json({ error: "Não foi possível salvar a consulta." }, { status: 500 });
  }
}
