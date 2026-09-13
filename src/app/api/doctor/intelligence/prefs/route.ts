import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getEffectivePrefs, upsertPrefs } from "@/lib/intelligence-prefs-store";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const prefs = await getEffectivePrefs(doctorId);
    return NextResponse.json({ prefs, applyMode: "review_only" });
  } catch (err) {
    console.error("[intelligence-prefs] get", err);
    return NextResponse.json({
      prefs: {
        enabled: true,
        applyMode: "review_only",
        modules: { lifestyle: true, meds: true, comorbidities: true, kidney: true, urine: true },
        allowBackfill: true,
        source: "default",
      },
    });
  }
}

export async function PUT(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const prefs = await upsertPrefs({
    scope: "doctor",
    scopeId: doctorId,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    modules: body.modules && typeof body.modules === "object" ? body.modules : undefined,
    allowBackfill: typeof body.allowBackfill === "boolean" ? body.allowBackfill : undefined,
  });
  return NextResponse.json({ prefs });
}
