import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import {
  createLetterhead,
  deleteLetterhead,
  duplicateLetterhead,
  listLetterheads,
  toPublicLetterhead,
  updateLetterhead,
  type LetterheadMime,
  type LetterheadPageMode,
} from "@/lib/letterheads-store";

const ALLOWED_MIME: LetterheadMime[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const MAX_DATA_URL = 3_500_000; // ~2.5MB arquivo

export async function GET() {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const list = await listLetterheads(doctorId);
  return NextResponse.json({ letterheads: list.map(toPublicLetterhead) });
}

export async function POST(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const fileData = String(body.fileData || "");
  const mime = String(body.mime || "") as LetterheadMime;
  const fileName = body.fileName ? String(body.fileName) : null;

  if (!name) return NextResponse.json({ error: "Informe o nome do modelo." }, { status: 400 });
  if (!fileData.startsWith("data:")) {
    return NextResponse.json({ error: "Envie o arquivo em data URL." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(mime) && !fileData.startsWith("data:application/pdf") && !fileData.startsWith("data:image/")) {
    return NextResponse.json({ error: "Formato inválido. Use PDF, PNG, JPG ou WEBP." }, { status: 400 });
  }
  if (fileData.length > MAX_DATA_URL) {
    return NextResponse.json({ error: "Arquivo muito grande. Use até ~2,5 MB." }, { status: 400 });
  }

  const resolvedMime: LetterheadMime =
    ALLOWED_MIME.includes(mime)
      ? mime
      : fileData.startsWith("data:application/pdf")
        ? "application/pdf"
        : fileData.startsWith("data:image/png")
          ? "image/png"
          : fileData.startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";

  const created = await createLetterhead({
    doctorId,
    name,
    mime: resolvedMime,
    fileData,
    fileName,
    marginTop: Number(body.marginTop ?? 22),
    marginBottom: Number(body.marginBottom ?? 18),
    marginLeft: Number(body.marginLeft ?? 10),
    marginRight: Number(body.marginRight ?? 10),
    fields: body.fields || {},
    pageMode: (body.pageMode as LetterheadPageMode) || "all",
    isDefault: Boolean(body.isDefault),
    active: true,
  });

  return NextResponse.json({ letterhead: toPublicLetterhead(created) }, { status: 201 });
}

export async function PATCH(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  if (body.action === "duplicate") {
    const dup = await duplicateLetterhead(id, doctorId);
    if (!dup) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    return NextResponse.json({ letterhead: toPublicLetterhead(dup) });
  }

  const patch: Record<string, unknown> = {};
  for (const k of [
    "name",
    "fileData",
    "mime",
    "fileName",
    "marginTop",
    "marginBottom",
    "marginLeft",
    "marginRight",
    "fields",
    "pageMode",
    "isDefault",
    "active",
  ] as const) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (patch.fileData && String(patch.fileData).length > MAX_DATA_URL) {
    return NextResponse.json({ error: "Arquivo muito grande." }, { status: 400 });
  }

  const updated = await updateLetterhead(id, doctorId, patch as Parameters<typeof updateLetterhead>[2]);
  if (!updated) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ letterhead: toPublicLetterhead(updated) });
}

export async function DELETE(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  const ok = await deleteLetterhead(id, doctorId);
  if (!ok) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
