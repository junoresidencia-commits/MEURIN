import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { isCourtesyKind } from "@/lib/courtesy";
import {
  grantCourtesyCredit,
  listCourtesyCredits,
  listCourtesyForPatient,
  revokeCourtesyCredit,
} from "@/lib/courtesy-credits-store";

export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const url = new URL(req.url);
  const patientKey = url.searchParams.get("patientKey") || "";
  const credits = patientKey
    ? await listCourtesyForPatient(doctorId, patientKey)
    : await listCourtesyCredits(doctorId);
  return NextResponse.json({ credits });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patientKey = String(body.patientKey || "").trim();
  const kind = body.kind;
  if (!patientKey) return NextResponse.json({ error: "Informe o paciente." }, { status: 400 });
  if (!isCourtesyKind(kind)) {
    return NextResponse.json({ error: "Escolha retorno grátis ou consulta grátis." }, { status: 400 });
  }
  const access = await resolvePatientAccess(patientKey);
  if (!access?.allowed) {
    return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });
  }
  const { credit, alreadyOpen } = await grantCourtesyCredit({
    doctorId,
    patientKey: access.key || patientKey,
    patientName: access.name || String(body.patientName || "Paciente"),
    patientEmail: access.email || (body.patientEmail ? String(body.patientEmail) : null),
    kind,
  });
  return NextResponse.json(
    {
      ok: true,
      credit,
      alreadyOpen,
      message: alreadyOpen
        ? `Este paciente já tinha uma consulta grátis. Atualizado para ${kind === "retorno" ? "retorno grátis" : "consulta grátis"}.`
        : kind === "retorno"
          ? "Retorno grátis liberado. O paciente pode agendar online sem pagar."
          : "Consulta grátis liberada. O paciente pode agendar online sem pagar.",
    },
    { status: alreadyOpen ? 200 : 201 }
  );
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Informe o crédito." }, { status: 400 });
  const credit = await revokeCourtesyCredit(doctorId, id);
  if (!credit) return NextResponse.json({ error: "Crédito não encontrado ou já usado." }, { status: 404 });
  return NextResponse.json({ ok: true, credit });
}
