import { NextResponse } from "next/server";
import { requireAllied, resolveAlliedPatientAccess } from "@/lib/allied-access";
import { addAlliedNote, listNotesForPatient, ROLE_META } from "@/lib/allied-store";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolveAlliedPatientAccess(decodeURIComponent(key), pro);
  if (!access) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const notes = await listNotesForPatient(access.key, pro.role);
  return NextResponse.json({ notes });
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const pro = await requireAllied();
  if (!pro) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const access = await resolveAlliedPatientAccess(decodeURIComponent(key), pro);
  if (!access) return NextResponse.json({ error: "Sem acesso a este paciente." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "anamnese" || b.kind === "avaliacao" ? b.kind : "evolucao";
  const body = String(b.body || "").trim();
  const payload = b.payload && typeof b.payload === "object" ? b.payload as Record<string, unknown> : {};
  if (!body && Object.keys(payload).length === 0) return NextResponse.json({ error: "Escreva a evolução ou preencha a avaliação." }, { status: 400 });
  const shareWithTeam = ROLE_META[pro.role].shareByDefault ? b.shareWithTeam !== false : b.shareWithTeam === true;
  const note = await addAlliedNote({
    role: pro.role, kind, professionalId: pro.id, professionalName: pro.name, registry: pro.registry || null,
    patientKey: access.key, title: b.title ? String(b.title) : kind === "anamnese" ? "Anamnese" : "Evolução",
    body, payload, shareWithTeam, createdBy: pro.id, updatedBy: null,
  });
  return NextResponse.json({ ok: true, note }, { status: 201 });
}
