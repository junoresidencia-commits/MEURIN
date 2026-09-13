import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import {
  collectIntegrityCounts,
  countsDropped,
  latestIntegritySnapshot,
  saveIntegritySnapshot,
} from "@/lib/platform-integrity";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const counts = await collectIntegrityCounts();
  const previous = await latestIntegritySnapshot();
  const dropped = previous ? countsDropped(previous.counts, counts) : [];
  const stale =
    !previous ||
    Date.now() - new Date(previous.createdAt).getTime() > 60 * 60 * 1000 ||
    JSON.stringify(previous.counts) !== JSON.stringify(counts);
  if (stale) {
    await saveIntegritySnapshot("plataforma-integridade", counts);
  }
  return NextResponse.json({
    counts,
    at: new Date().toISOString(),
    previous: previous ? { counts: previous.counts, at: previous.createdAt } : null,
    dropped,
  });
}
