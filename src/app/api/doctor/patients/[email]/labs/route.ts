import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { addLabResult, getLabResults, deleteLabResult, type LabResult } from "@/lib/patient-store";
import { resolvePatientAccess, type PatientAccess } from "@/lib/doctor-access";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";
import { labCollisionDay, normalizeMeasuredAt } from "@/lib/lab-dates";
import { estimateEgfr, estimateEgfrCystatin, EGFR_EQUATION, EGFR_CYS_EQUATION, EGFR_VERSION } from "@/lib/egfr";

const VALID = new Set(NEPHRO_LABS.map((l) => l.key));

function dayOf(iso: string): string {
  return labCollisionDay(iso);
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

/**
 * TFGe por cistatina C: ao registrar cistatina, calcula a TFGe (CKD-EPI Cistatina C 2021),
 * preservando a cistatina de origem, data, equação e versão. Gráfico próprio (tfge_cistatina),
 * separado da TFGe por creatinina. Substitui apenas a TFGe-cistatina automática da mesma data.
 */
async function autoEgfrCystatin(
  access: PatientAccess,
  doctorId: string | null,
  cystatinValue: number,
  at: string
): Promise<LabResult | null> {
  const egfr = estimateEgfrCystatin(cystatinValue, access.birthdate, access.sex, at);
  if (egfr == null) return null;
  const labs = await getLabResults(access.key);
  const stale = labs.filter(
    (l) => l.testKey === "tfge_cistatina" && dayOf(l.measuredAt) === dayOf(at) && String(l.origin || "").includes("Cistatina")
  );
  for (const s of stale) await deleteLabResult(s.id);
  return addLabResult({
    patientEmail: access.key,
    doctorId: doctorId || null,
    testKey: "tfge_cistatina",
    value: egfr,
    unit: labUnit("tfge_cistatina"),
    origin: `${EGFR_CYS_EQUATION} ${EGFR_VERSION}`,
    measuredAt: at,
    meta: {
      equation: EGFR_CYS_EQUATION,
      version: EGFR_VERSION,
      basedOnTestKey: "cistatina_c",
      basedOnValue: cystatinValue,
      basedOnDate: at,
      computedAt: new Date().toISOString(),
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
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

  // Lote (importação da evolução/laudo com VÁRIAS datas):
  // { results: [{ testKey, value, unit?, measuredAt?, onConflict? }] }
  // Cada item é salvo NA SUA data. Nada é apagado; exames anteriores são preservados.
  if (Array.isArray(body.results)) {
    const defaultAt = normalizeMeasuredAt(body.measuredAt);
    // Cópia de trabalho: inclui os já existentes e vai recebendo os inseridos no próprio lote,
    // para deduplicar corretamente mesmo com múltiplas datas de uma vez.
    const work = [...(await getLabResults(access.key))];
    const saved: unknown[] = [];
    let updated = 0;
    let kept = 0;
    let duplicate = 0; // mesmo exame + mesma data + mesmo resultado
    const rejected: { testKey: string; reason: string }[] = [];
    const conflicts: { testKey: string; date: string; existingValue: number; newValue: number }[] = [];
    const sameValue = (a: number, b: number) => Math.round(a * 1000) === Math.round(b * 1000);

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
      const at = item?.measuredAt ? normalizeMeasuredAt(item.measuredAt) : defaultAt;
      const day = dayOf(at);
      const onConflict = item?.onConflict === "keep" || item?.onConflict === "update" ? item.onConflict : null;

      const collisions = work.filter((l) => l.testKey === key && dayOf(l.measuredAt) === day);

      // 1) Duplicata exata (mesmo exame + data + resultado) => nunca duplica.
      if (collisions.some((c) => sameValue(c.value, val))) {
        duplicate += 1;
        continue;
      }

      // 2) Já existe o mesmo exame na mesma data com valor DIFERENTE.
      if (collisions.length > 0) {
        if (onConflict === "keep") {
          kept += 1;
          continue;
        }
        if (onConflict === "update") {
          for (const c of collisions) {
            await deleteLabResult(c.id);
            const idx = work.indexOf(c);
            if (idx >= 0) work.splice(idx, 1);
          }
          updated += 1;
        } else {
          // Sem política definida: NÃO apaga nem duplica silenciosamente — sinaliza p/ revisão.
          conflicts.push({ testKey: key, date: day, existingValue: collisions[0].value, newValue: val });
          continue;
        }
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
      work.push(lab as LabResult);

      if (key === "creatinina") {
        const egfr = await autoEgfr(access, doctorId || null, val, at);
        if (egfr) { saved.push(egfr); work.push(egfr); }
      }
      if (key === "cistatina_c") {
        const egfrc = await autoEgfrCystatin(access, doctorId || null, val, at);
        if (egfrc) { saved.push(egfrc); work.push(egfrc); }
      }
    }
    return NextResponse.json(
      { saved, updated, kept, duplicate, conflicts, rejected, count: saved.length },
      { status: 201 }
    );
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
  const measuredAt = normalizeMeasuredAt(body.measuredAt);
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
  if (testKey === "cistatina_c") {
    egfr = await autoEgfrCystatin(access, doctorId || null, value, measuredAt);
    if (!egfr) egfrSkipped = "Cadastre data de nascimento e sexo do paciente para calcular a TFGe por cistatina.";
  }

  return NextResponse.json({ lab, egfr, egfrSkipped }, { status: 201 });
  } catch (err) {
    console.error("[labs] POST", err);
    return NextResponse.json({ error: "Não foi possível salvar os exames. Tente novamente." }, { status: 500 });
  }
}
