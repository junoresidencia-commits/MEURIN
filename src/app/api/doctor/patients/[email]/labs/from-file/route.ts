import { NextResponse } from "next/server";
import { resolvePatientAccess } from "@/lib/doctor-access";
import { extractLabFileText } from "@/lib/hd-lab-file-text";
import { parseLabGroups } from "@/lib/lab-parser";
import { extractLabeledPatientName } from "@/lib/ocr-text";
import { normName } from "@/lib/hd-store-names";

const MAX = 12 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email: rawParam } = await params;
  const access = await resolvePatientAccess(rawParam);
  if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Você não tem acesso a este paciente." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Envie a foto ou o PDF do laudo." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX) return NextResponse.json({ error: "Arquivo maior que 12 MB." }, { status: 400 });

  try {
    const extracted = await extractLabFileText({
      name: file.name,
      type: file.type || "application/octet-stream",
      buffer: buf,
    });
    if (!extracted.text.trim()) {
      return NextResponse.json({
        groups: [],
        nameOnReport: null,
        nameMatches: false,
        note: extracted.note || "Não deu para ler o arquivo.",
      });
    }
    const groups = parseLabGroups(extracted.text);
    const nameOnReport = extractLabeledPatientName(extracted.text);
    const nameMatches = Boolean(
      nameOnReport && access.name && normName(access.name).includes(normName(nameOnReport).split(" ")[0] || "___")
    ) || Boolean(nameOnReport && access.name && normName(extracted.text).includes(normName(access.name)));

    const identified = groups.reduce((n, g) => n + g.labs.length, 0);
    return NextResponse.json({
      groups,
      nameOnReport,
      nameMatches,
      identified,
      note:
        identified === 0
          ? extracted.note || "Não reconheci exames nesta imagem. Cole o texto do laudo se a foto estiver ilegível."
          : nameOnReport
            ? `Identifiquei ${identified} exame(s). Laudo em nome de ${nameOnReport}.`
            : `Identifiquei ${identified} exame(s).`,
    });
  } catch (err) {
    console.error("[labs/from-file]", err);
    return NextResponse.json(
      { error: "A leitura da imagem travou. Tente outra foto ou cole o texto do laudo." },
      { status: 504 }
    );
  }
}
