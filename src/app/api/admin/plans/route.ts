import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { listAllEnrollments } from "@/lib/plans-store";
import { getDoctorById } from "@/lib/store";
import { processEnrollmentLifecycle } from "@/lib/plan-billing";

/** Visão global das contratações de plano (administrador), com filtros. */
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const fDoctor = sp.get("doctorId");
  const fStatus = sp.get("status");
  const fMethod = sp.get("method");
  const fPatient = sp.get("patient");

  let enrollments = await processEnrollmentLifecycle(await listAllEnrollments());
  if (fDoctor) enrollments = enrollments.filter((e) => e.doctorId === fDoctor);
  if (fStatus) enrollments = enrollments.filter((e) => e.status === fStatus);
  if (fMethod) enrollments = enrollments.filter((e) => e.paymentMethod === fMethod);
  if (fPatient) {
    const q = fPatient.toLowerCase();
    enrollments = enrollments.filter(
      (e) => e.patientName.toLowerCase().includes(q) || e.patientKey.toLowerCase().includes(q)
    );
  }

  const doctorNames = new Map<string, string>();
  const rows = await Promise.all(
    enrollments.map(async (e) => {
      if (!doctorNames.has(e.doctorId)) {
        const doc = await getDoctorById(e.doctorId);
        doctorNames.set(e.doctorId, doc?.name ?? "—");
      }
      return { ...e, doctorName: doctorNames.get(e.doctorId) };
    })
  );

  // Totais para o resumo do admin.
  const paid = rows.filter((e) => ["ativo", "concluido", "expirado", "suspenso"].includes(e.status));
  const totals = {
    count: rows.length,
    active: rows.filter((e) => e.status === "ativo").length,
    grossCents: paid.reduce((s, e) => s + (e.pricing?.finalPriceCents ?? 0), 0),
    doctorCents: paid.reduce((s, e) => s + (e.pricing?.doctorAmountCents ?? 0), 0),
    platformCents: paid.reduce((s, e) => s + (e.pricing?.platformAmountCents ?? 0), 0),
  };

  return NextResponse.json({ enrollments: rows, totals });
}
