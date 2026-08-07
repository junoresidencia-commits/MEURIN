import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { createLink, deleteLink, listLinksByDoctor } from "@/lib/links-store";

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const links = await listLinksByDoctor(doctorId);
  return NextResponse.json({ links });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: { title?: unknown; url?: unknown; category?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const url = normalizeUrl(String(body.url || ""));
  if (!title) return NextResponse.json({ error: "Informe um título." }, { status: 400 });
  if (!url) return NextResponse.json({ error: "Informe um link (URL) válido." }, { status: 400 });

  const link = await createLink({
    doctorId,
    title,
    url,
    category: body.category ? String(body.category).trim() : null,
    note: body.note ? String(body.note).trim() : null,
  });
  return NextResponse.json({ link }, { status: 201 });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const ok = await deleteLink(String(body.id || ""), doctorId);
  if (!ok) return NextResponse.json({ error: "Link não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
