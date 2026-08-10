import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { getLetterhead } from "@/lib/letterheads-store";
import { LETTERHEADS_BUCKET, readFile } from "@/lib/doc-storage";

/** Serve o arquivo do papel timbrado apenas ao médico dono (para preview/configuração). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  const lh = await getLetterhead(id);
  if (!lh || lh.doctorId !== doctorId) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const file = await readFile(LETTERHEADS_BUCKET, lh.storage, lh.filePath);
  if (!file) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": lh.mime || file.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="timbrado-${id}"`,
    },
  });
}
