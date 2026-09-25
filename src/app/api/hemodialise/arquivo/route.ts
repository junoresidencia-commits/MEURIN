import { NextResponse } from "next/server";
import { getHdActor, hdPerm } from "@/lib/hd-access";
import { buildHdMapPdf } from "@/lib/hd-pdf";
import {
  hdExportXlsx,
  hdImportLabSheet,
  hdImportSalaBranca,
  hdListMap,
  hdSaveLabFile,
  requireHd,
} from "@/lib/hd-store";
import { HD_BUCKET, readFile } from "@/lib/doc-storage";
import { monthLabel } from "@/lib/hd-labels";

const MAX = 12 * 1024 * 1024;

export async function GET(req: Request) {
  const actor = await getHdActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const ctx = await requireHd(actor);
  if (!ctx) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "xlsx";
  const year = Number(url.searchParams.get("year") || 0) || undefined;
  const month = Number(url.searchParams.get("month") || 0) || undefined;

  try {
    if (kind === "file") {
      const id = url.searchParams.get("id") || "";
      const exams = await (await import("@/lib/hd-store")).hdListExams(ctx, year, month);
      const file = exams.files.find((f) => f.id === id);
      if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
      const data = await readFile(HD_BUCKET, file.storage, file.path);
      if (!data) return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
      return new NextResponse(new Uint8Array(data.buffer), {
        headers: {
          "Content-Type": data.mime || file.mime,
          "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
        },
      });
    }
    if (kind === "pdf") {
      const map = await hdListMap(ctx, year, month);
      const buf = await buildHdMapPdf({
        unitName: ctx.unit.name,
        year: map.month.year,
        month: map.month.month,
        rows: map.rows,
      });
      const name = `mapa-hemodialise-${map.month.year}-${String(map.month.month).padStart(2, "0")}.pdf`;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${name}"`,
        },
      });
    }
    const buf = await hdExportXlsx(ctx, year, month);
    const map = await hdListMap(ctx, year, month);
    const name = `Mapa Sala Branca - ${monthLabel(map.month.year, map.month.month)}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao exportar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const actor = await getHdActor();
  if (!actor) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const ctx = await requireHd(actor);
  if (!ctx) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const form = await req.formData();
  const intent = String(form.get("intent") || "import_map");
  const year = Number(form.get("year") || 0) || undefined;
  const month = Number(form.get("month") || 0) || undefined;
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX) return NextResponse.json({ error: "Arquivo maior que 12 MB." }, { status: 400 });

  try {
    if (intent === "import_map") {
      if (!hdPerm(ctx.member, "manage_config", actor.isSuperAdmin) && !hdPerm(ctx.member, "edit_prescription", actor.isSuperAdmin)) {
        return NextResponse.json({ error: "Sem permissão para importar o mapa." }, { status: 403 });
      }
      const result = await hdImportSalaBranca(ctx, buf, file.name);
      return NextResponse.json(result);
    }
    if (intent === "import_labs") {
      if (!hdPerm(ctx.member, "upload_exams", actor.isSuperAdmin) && !hdPerm(ctx.member, "confirm_ocr", actor.isSuperAdmin)) {
        return NextResponse.json({ error: "Sem permissão para enviar exames." }, { status: 403 });
      }
      const result = await hdImportLabSheet(ctx, buf, year, month);
      return NextResponse.json(result);
    }
    if (intent === "upload_exam") {
      if (!hdPerm(ctx.member, "upload_exams", actor.isSuperAdmin) && !hdPerm(ctx.member, "confirm_ocr", actor.isSuperAdmin)) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      const rec = await hdSaveLabFile(ctx, { name: file.name, type: file.type || "application/octet-stream", buffer: buf }, year, month);
      return NextResponse.json({
        file: rec,
        note: "Documento original guardado. A IA não prescreve. Confirme valores lidos ou digite o resultado.",
      });
    }
    return NextResponse.json({ error: "Intent inválido." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
