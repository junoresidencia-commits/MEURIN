import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { addLabResult } from "@/lib/patient-store";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { NEPHRO_LABS, labUnit } from "@/lib/labs";
import { estimateEgfr } from "@/lib/egfr";

const VALID = new Set(NEPHRO_LABS.map((l) => l.key));

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

  // Ao registrar creatinina, calcula a TFGe automaticamente (CKD-EPI 2021)
  // usando idade (data de nascimento) e sexo do paciente, e adiciona ao gráfico.
  let egfr = null;
  let egfrSkipped: string | null = null;
  if (testKey === "creatinina") {
    const value2 = estimateEgfr(value, access.birthdate, access.sex, measuredAt);
    if (value2 != null) {
      egfr = await addLabResult({
        patientEmail: access.key,
        doctorId: doctorId || null,
        testKey: "tfge",
        value: value2,
        unit: labUnit("tfge"),
        referenceRange: null,
        origin: "CKD-EPI 2021",
        measuredAt,
      });
    } else {
      egfrSkipped =
        "Cadastre a data de nascimento e o sexo do paciente para calcular o TFGe automaticamente.";
    }
  }

  return NextResponse.json({ lab, egfr, egfrSkipped }, { status: 201 });
}
