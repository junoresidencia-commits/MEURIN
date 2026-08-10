import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { deleteLetterhead, getLetterhead, setDefaultLetterhead, updateLetterhead, type LetterheadArea } from "@/lib/letterheads-store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const lh = await getLetterhead(id);
  if (!lh || lh.doctorId !== doctorId) return NextResponse.json({ error: "Papel timbrado não encontrado." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (body.setDefault === true) {
    await setDefaultLetterhead(id, doctorId);
    return NextResponse.json({ ok: true });
  }
  const patch: { name?: string; active?: boolean; area?: LetterheadArea } = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.area && typeof body.area === "object") {
    const a = body.area as Record<string, unknown>;
    patch.area = {
      marginTop: num(a.marginTop, lh.area.marginTop),
      marginBottom: num(a.marginBottom, lh.area.marginBottom),
      marginLeft: num(a.marginLeft, lh.area.marginLeft),
      marginRight: num(a.marginRight, lh.area.marginRight),
      repeat: (a.repeat === "first" || a.repeat === "simplified" || a.repeat === "all") ? a.repeat : lh.area.repeat,
      showPatientHeader: typeof a.showPatientHeader === "boolean" ? a.showPatientHeader : lh.area.showPatientHeader,
      showSignature: typeof a.showSignature === "boolean" ? a.showSignature : lh.area.showSignature,
    };
  }
  const updated = await updateLetterhead(id, doctorId, patch);
  return NextResponse.json({ ok: true, letterhead: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const lh = await getLetterhead(id);
  if (!lh || lh.doctorId !== doctorId) return NextResponse.json({ error: "Papel timbrado não encontrado." }, { status: 404 });
  await deleteLetterhead(id, doctorId);
  return NextResponse.json({ ok: true });
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(0.45, Math.max(0, n)) : fallback;
}
