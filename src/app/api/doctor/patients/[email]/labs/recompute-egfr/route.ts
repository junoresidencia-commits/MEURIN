import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getLabResults, addLabResult } from "@/lib/patient-store";
import { labUnit } from "@/lib/labs";
import { estimateEgfr, estimateEgfrCystatin, EGFR_EQUATION, EGFR_CYS_EQUATION, EGFR_VERSION } from "@/lib/egfr";

function dayOf(iso: string) { return iso.slice(0, 10); }

// Recalcula a TFGe (CKD-EPI) para a última creatinina e a última cistatina C,
// usando idade/sexo atuais. Útil após completar o cadastro (idade/sexo).
export async function POST(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const access = await resolvePatientAccess(decodeURIComponent(email));
  if (!access || !access.allowed) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });

  const labs = await getLabResults(access.key);
  const computed: string[] = [];

  const lastOf = (key: string) => {
    let found = null as (typeof labs)[number] | null;
    for (const l of labs) if (l.testKey === key && (!found || l.measuredAt > found.measuredAt)) found = l;
    return found;
  };

  const creat = lastOf("creatinina");
  if (creat) {
    const egfr = estimateEgfr(creat.value, access.birthdate, access.sex, creat.measuredAt);
    const already = labs.some((l) => l.testKey === "tfge" && dayOf(l.measuredAt) === dayOf(creat.measuredAt) && String(l.origin || "").includes("CKD-EPI"));
    if (egfr != null && !already) {
      await addLabResult({
        patientEmail: access.key, doctorId, testKey: "tfge", value: egfr, unit: labUnit("tfge"),
        origin: `Calculada (${EGFR_EQUATION} ${EGFR_VERSION})`,
        meta: { equation: EGFR_EQUATION, version: EGFR_VERSION, basedOnTestKey: "creatinina", basedOnValue: creat.value },
        measuredAt: creat.measuredAt,
      });
      computed.push("tfge");
    }
  }

  const cys = lastOf("cistatina_c");
  if (cys) {
    const egfr = estimateEgfrCystatin(cys.value, access.birthdate, access.sex, cys.measuredAt);
    const already = labs.some((l) => l.testKey === "tfge_cistatina" && dayOf(l.measuredAt) === dayOf(cys.measuredAt) && String(l.origin || "").includes("Cistatina"));
    if (egfr != null && !already) {
      await addLabResult({
        patientEmail: access.key, doctorId, testKey: "tfge_cistatina", value: egfr, unit: labUnit("tfge_cistatina"),
        origin: `Calculada (${EGFR_CYS_EQUATION} ${EGFR_VERSION})`,
        meta: { equation: EGFR_CYS_EQUATION, version: EGFR_VERSION, basedOnTestKey: "cistatina_c", basedOnValue: cys.value },
        measuredAt: cys.measuredAt,
      });
      computed.push("tfge_cistatina");
    }
  }

  return NextResponse.json({ ok: true, computed });
}
