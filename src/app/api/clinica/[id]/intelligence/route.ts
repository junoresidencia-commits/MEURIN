import { NextResponse } from "next/server";
import { requireClinicAdmin } from "@/lib/platform-access";
import { getStoredPrefs, upsertPrefs } from "@/lib/intelligence-prefs-store";
import { DEFAULT_INTEL_MODULES, DEFAULT_INTEL_PREFS } from "@/lib/intelligence-prefs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const stored = await getStoredPrefs("clinic", id);
  const prefs = stored
    ? {
        enabled: stored.enabled,
        applyMode: "review_only" as const,
        modules: stored.modules,
        allowBackfill: stored.allowBackfill,
        source: "clinic" as const,
      }
    : { ...DEFAULT_INTEL_PREFS, modules: { ...DEFAULT_INTEL_MODULES } };
  return NextResponse.json({ prefs, applyMode: "review_only" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireClinicAdmin(id);
  if (!staff) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const prefs = await upsertPrefs({
    scope: "clinic",
    scopeId: id,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    modules: body.modules && typeof body.modules === "object" ? body.modules : undefined,
    allowBackfill: typeof body.allowBackfill === "boolean" ? body.allowBackfill : undefined,
  });
  return NextResponse.json({ prefs });
}
