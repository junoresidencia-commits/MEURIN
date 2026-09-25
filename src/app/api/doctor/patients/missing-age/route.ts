import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listPatientsByDoctor, updatePatient } from "@/lib/patients-store";
import { hasAgeInfo, normalizeAgeReportedAt, parseAgeYears } from "@/lib/patient-age";

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const mine = await listPatientsByDoctor(doctorId);
  const patients = mine
    .filter((p) => p.status !== "archived" && !hasAgeInfo(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      birthdate: p.birthdate || null,
      ageYears: p.ageYears ?? null,
      ageReportedAt: p.ageReportedAt || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return NextResponse.json({ patients, total: mine.filter((p) => p.status !== "archived").length });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const mine = await listPatientsByDoctor(doctorId);
  const owned = new Set(mine.map((p) => p.id));
  let saved = 0;
  for (const item of items) {
    const id = String(item.id || "");
    if (!id || !owned.has(id)) continue;
    const birthdate = item.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(String(item.birthdate)) ? String(item.birthdate) : undefined;
    const ageYears = item.ageYears !== undefined ? parseAgeYears(item.ageYears) : undefined;
    const ageReportedAt = item.ageReportedAt !== undefined ? normalizeAgeReportedAt(item.ageReportedAt) : undefined;
    if (!birthdate && ageYears == null) continue;
    const patch: { birthdate?: string; ageYears?: number | null; ageReportedAt?: string | null } = {};
    if (birthdate) patch.birthdate = birthdate;
    else {
      patch.ageYears = ageYears ?? null;
      patch.ageReportedAt = ageReportedAt ?? (ageYears != null ? new Date().toISOString().slice(0, 10) : null);
    }
    const ok = await updatePatient(id, patch);
    if (ok) saved += 1;
  }
  return NextResponse.json({ ok: true, saved });
}
