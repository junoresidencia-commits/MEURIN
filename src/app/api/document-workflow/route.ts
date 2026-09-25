import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { getEncounterWorkflow } from "@/lib/document-workflow/service";
import { getAvailableSignatureMethods } from "@/lib/document-workflow/signature";
import { flagsFromEnv } from "@/lib/document-workflow/flags";
import { jsonUtf8 } from "@/lib/json-utf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  const patient = new URL(req.url).searchParams.get("patient") || "";
  if (!patient) return jsonUtf8({ error: "Informe o paciente." }, 400);
  const access = await resolvePatientAccess(patient);
  if (!access?.allowed) return jsonUtf8({ error: "Sem acesso a este paciente." }, 403);

  const workflow = await getEncounterWorkflow({
    patientKey: access.key,
    composerHref: `/medicos/paciente/${encodeURIComponent(access.key)}/documento`,
  });
  return NextResponse.json({
    ok: true,
    flags: flagsFromEnv(),
    workflow,
    signatureOptions: getAvailableSignatureMethods(),
  });
}
