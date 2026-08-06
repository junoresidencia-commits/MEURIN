import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { createProtocol, deleteProtocol, listProtocols, type ProtocolMed } from "@/lib/protocols-store";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  return NextResponse.json({ protocols: await listProtocols(false) });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const b = await req.json();
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Informe o nome do protocolo." }, { status: 400 });

  const medications: ProtocolMed[] = Array.isArray(b.medications)
    ? b.medications
        .filter((m: { name?: string }) => m && String(m.name || "").trim())
        .map((m: ProtocolMed) => ({
          name: String(m.name),
          presentation: m.presentation ? String(m.presentation) : "",
          monthlyQty: m.monthlyQty ? String(m.monthlyQty) : "",
        }))
    : [];
  const toList = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map(String).filter(Boolean)
      : String(v || "")
          .split(/\n|;/)
          .map((s) => s.trim())
          .filter(Boolean);

  const protocol = await createProtocol({
    name,
    cid10: b.cid10 ? String(b.cid10) : null,
    medications,
    requiredExams: toList(b.requiredExams),
    requiredDocuments: toList(b.requiredDocuments),
    notes: b.notes ? String(b.notes) : null,
    source: b.source ? String(b.source) : null,
    active: b.active !== false,
  });
  return NextResponse.json({ ok: true, id: protocol.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await deleteProtocol(id);
  return NextResponse.json({ ok: true });
}
