import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getLetterhead } from "@/lib/letterheads-store";

/** Retorna o papel timbrado completo (inclui arquivo) — somente do dono. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const lh = await getLetterhead(id, doctorId);
  if (!lh) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ letterhead: lh });
}
