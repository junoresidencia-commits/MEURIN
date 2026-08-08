import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { addLabResult, getLabResults, deleteLabResult, type LabResult } from "@/lib/patient-store";
import { resolvePatientAccess, type PatientAccess } from "@/lib/doctor-access";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";
import { estimateEgfr, EGFR_EQUATION, EGFR_VERSION } from "@/lib/egfr";

const VALID = new Set(NEPHRO_LABS.map((l) => l.key));

function dayOf(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * TFGe histórica: ao registrar creatinina, calcula a TFGe (CKD-EPI 2021) e a grava
 * preservando a creatinina de origem, a data, a equação e a versão (para recalcular
 * a base no futuro se a equação mudar). Substitui apenas a TFGe automática da mesma data.
 */
async function autoEgfr(
  access: PatientAccess,
  doctorId: string | null,
  creatValue: number,
  at: string
): Promise<LabResult | null> {
  const egfr = estimateEgfr(creatValue, access.birthdate, access.sex, at);
  if (egfr == null) return null;
  const labs = await getLabResults(access.key);
  const stale = labs.filter(
    (l) => l.testKey === "tfge" && dayOf(l.measuredAt) === dayOf(at) && String(l.origin || "").includes("CKD-EPI")
  );
  for (const s of stale) await deleteLabResult(s.id);
  return addLabResult({
    patientEmail: access.key,
    doctorId: doctorId || null,
    testKey: "tfge",
    value: egfr,
    unit: labUnit("tfge"),
    origin: `${EGFR_EQUATION} ${EGFR_VERSION}`,
    measuredAt: at,
    meta: {
      equation: EGFR_EQUATION,
      version: EGFR_VERSION,
      basedOnTestKey: "creatinina",
      basedOnValue: creatValue,
      basedOnDate: at,
      computedAt: new Date().toISOString(),
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const doctorId = await getDoctorSessionId();
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }

  const body = await req.json();

  // Lote (importação da evolução): { results: [{ testKey, value, unit?, measuredAt?, onConflict? }] }
  if (Array.isArray(body.results)) {
    const defaultAt = body.measuredAt
      ? new Date(String(body.measuredAt)).toISOString()
      : new Date().toISOString();
    const existing = await getLabResults(access.key);
    const saved: unknown[] = [];
    let updated = 0;
    let kept = 0;
    const rejected: { testKey: string; reason: string }[] = [];

    for (const item of body.results) {
      const key = String(item?.testKey || "");
      const val = Number(String(item?.value).replace(",", "."));
      if (!VALID.has(key)) {
        rejected.push({ testKey: key, reason: "exame inválido" });
        continue;
      }
      if (!Number.isFinite(val)) {
        rejected.push({ testKey: key, reason: "valor inválido" });
        continue;
      }
      const at = item?.measuredAt ? new Date(String(item.measuredAt)).toISOString() : defaultAt;
      const onConflict = item?.onConflict === "keep" || item?.onConflict === "update" ? item.onConflict : null;

      // Já existe exame igual (mesma chave) na mesma data?
      const collisions = existing.filter((l) => l.testKey === key && dayOf(l.measuredAt) === dayOf(at));
      if (collisions.length > 0) {
        if (onConflict === "keep") {
          kept += 1;
          continue;
        }
        if (onConflict === "update") {
          for (const c of collisions) await deleteLabResult(c.id);
          updated += 1;
        }
        // sem política definida => trata como inserção normal (adiciona mais um ponto)
      }

      const lab = await addLabResult({
        patientEmail: access.key,
        doctorId: doctorId || null,
        testKey: key,
        value: val,
        unit: item?.unit ? String(item.unit) : labUnit(key),
        referenceRange: item?.referenceRange ? String(item.referenceRange) : null,
        origin: item?.origin ? String(item.origin) : body.origin ? String(body.origin) : "evolução",
        measuredAt: at,
      });
      saved.push(lab);

      if (key === "creatinina") {
        const egfr = await autoEgfr(access, doctorId || null, val, at);
        if (egfr) saved.push(egfr);
      }
    }
    return NextResponse.json({ saved, updated, kept, rejected, count: saved.length }, { status: 201 });
  }

  // Registro único (formulário manual)
  const testKey = String(body.testKey || "");
  if (!VALID.has(testKey)) {
    return NextResponse.json({ error: "Exame inválido." }, { status: 400 });
  }
  const value = Number(String(body.value).replace(",", "."));
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }
  const measuredAt = body.measuredAt ? new Date(String(body.measuredAt)).toISOString() : new Date().toISOString();
  const lab = await addLabResult({
    patientEmail: access.key,
    doctorId: doctorId || null,
    testKey,
    value,
    unit: body.unit ? String(body.unit) : labUnit(testKey),
    referenceRange: body.referenceRange ? String(body.referenceRange) : null,
    origin: body.origin ? String(body.origin) : "médico",
    measuredAt,
  });

  let egfr: LabResult | null = null;
  let egfrSkipped: string | null = null;
  if (testKey === "creatinina") {
    egfr = await autoEgfr(access, doctorId || null, value, measuredAt);
    if (!egfr) egfrSkipped = "Cadastre data de nascimento e sexo do paciente para calcular a TFGe automaticamente.";
  }

  return NextResponse.json({ lab, egfr, egfrSkipped }, { status: 201 });
}
