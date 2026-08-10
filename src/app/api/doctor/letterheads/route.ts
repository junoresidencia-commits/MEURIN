import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { listLetterheads, saveLetterheadUpload } from "@/lib/letterheads-store";

export const maxDuration = 30;

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX = 12 * 1024 * 1024; // 12 MB

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const letterheads = await listLetterheads(doctorId);
  // Nunca devolve o caminho de storage bruto; só metadados + URL de preview autenticada.
  return NextResponse.json({
    letterheads: letterheads.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      mime: l.mime,
      isDefault: l.isDefault,
      active: l.active,
      area: l.area,
      createdAt: l.createdAt,
      fileUrl: `/api/doctor/letterheads/${l.id}/file`,
    })),
  });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    const name = String(form.get("name") || "").trim();
    if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo (PDF, PNG ou JPG)." }, { status: 400 });
    const type = file.type || "";
    if (!ALLOWED.includes(type) && !/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      return NextResponse.json({ error: "Formato não suportado. Use PDF, PNG ou JPG." }, { status: 400 });
    }
    if (file.size > MAX) return NextResponse.json({ error: "Arquivo muito grande (máx. 12 MB)." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const lh = await saveLetterheadUpload(doctorId, name || file.name.replace(/\.[^.]+$/, ""), {
      name: file.name,
      type,
      buffer,
    });
    return NextResponse.json({ ok: true, id: lh.id }, { status: 201 });
  } catch (err) {
    console.error("letterheads POST", err);
    return NextResponse.json({ error: "Não foi possível salvar o papel timbrado." }, { status: 500 });
  }
}
