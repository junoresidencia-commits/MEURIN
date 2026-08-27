import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { listAlliedReferralsForPatient, currentAssignment, getAlliedProfessional, setAlliedReferralStatus } from "@/lib/allied-store";
import { listReferralsForPatient, getNutritionist, setReferralStatus } from "@/lib/nutritionists-store";

export async function GET(_req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { email } = await params;
  const access = await resolvePatientAccess(decodeURIComponent(email));
  if (!access?.allowed) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const [alliedRefs, nutRefs] = await Promise.all([
    listAlliedReferralsForPatient(access.key),
    listReferralsForPatient(access.key),
  ]);

  const psy = currentAssignment(alliedRefs, "psychology");
  const nur = currentAssignment(alliedRefs, "nursing");
  const nutRef = nutRefs.find((r) => r.status !== "encerrado") || null;
  const nut = nutRef?.nutritionistId ? await getNutritionist(nutRef.nutritionistId) : null;
  const psyPro = psy ? await getAlliedProfessional(psy.professionalId) : null;
  const nurPro = nur ? await getAlliedProfessional(nur.professionalId) : null;

  return NextResponse.json({
    nutrition: nut ? { id: nut.id, name: nut.name, registry: nut.crn, uf: nut.uf, referralId: nutRef?.id } : null,
    psychology: psyPro ? { id: psyPro.id, name: psyPro.name, registry: psyPro.registry, uf: psyPro.uf, referralId: psy?.id } : null,
    nursing: nurPro ? { id: nurPro.id, name: nurPro.name, registry: nurPro.registry, uf: nurPro.uf, referralId: nur?.id } : null,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolvePatientAccess(decodeURIComponent((await params).email));
  if (!access?.allowed) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const referralId = String(b.referralId || "");
  const role = String(b.role || "");
  if (!referralId) return NextResponse.json({ error: "Informe o encaminhamento." }, { status: 400 });
  if (role === "nutrition") await setReferralStatus(referralId, "encerrado");
  else await setAlliedReferralStatus(referralId, "encerrado");
  return NextResponse.json({ ok: true });
}
