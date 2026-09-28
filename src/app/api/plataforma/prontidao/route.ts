import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/platform-access";
import { writeAudit } from "@/lib/platform-store";
import {
  getReadinessAttestation,
  parseStagingUrl,
  saveReadinessAttestation,
} from "@/lib/readiness-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const attested = await getReadinessAttestation();
  return NextResponse.json({ attested });
}

export async function POST(req: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const current = await getReadinessAttestation();
  const next = { ...current, attestedBy: actor.email };
  const actions: string[] = [];

  if (typeof body.stagingUrl === "string") {
    const parsed = parseStagingUrl(body.stagingUrl);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    next.stagingUrl = parsed.url;
    actions.push(`staging ${parsed.url}`);
  }

  if (body.isolationConfirmed === true) {
    next.isolationTestedAt = new Date().toISOString().slice(0, 10);
    actions.push(`isolamento ${next.isolationTestedAt}`);
  }

  if (body.backupConfirmed === true) {
    next.backupRestoreTestedAt = new Date().toISOString().slice(0, 10);
    actions.push(`restore ${next.backupRestoreTestedAt}`);
  }

  if (actions.length === 0) {
    return NextResponse.json({ error: "Nada para gravar." }, { status: 400 });
  }

  const saved = await saveReadinessAttestation(next);
  try {
    await writeAudit({
      actorKind: "doctor",
      actorId: actor.doctorId,
      actorEmail: actor.email,
      action: "readiness_attestation",
      entity: "platform",
      entityId: "readiness",
      detail: actions.join("; "),
    });
  } catch (err) {
    console.warn("[prontidao] audit", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true, attested: saved });
}
