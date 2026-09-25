import { NextResponse } from "next/server";
import { getDoctorSessionId } from "@/lib/auth";
import { officialDocSlot, type OfficialDocKind } from "@/lib/ceaf-documents";
import { buildOfficialCeafPdf } from "@/lib/ceaf-official-pdf";
import { jsonUtf8 } from "@/lib/json-utf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DOCS: OfficialDocKind[] = ["ter", "form", "residencia"];

function asciiName(protocol: string, doc: string) {
  const slug = protocol.replace(/[^a-zA-Z0-9_-]+/g, "-") || "ceaf";
  return `${doc}-${slug}-oficial.pdf`;
}

/** Extrai as páginas oficiais exatas do pacote SESAB. Só médico logado. */
export async function GET(req: Request) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);

  const { searchParams } = new URL(req.url);
  const protocol = (searchParams.get("protocol") || "").trim();
  const doc = (searchParams.get("doc") || "") as OfficialDocKind;
  if (!DOCS.includes(doc)) return jsonUtf8({ error: "Informe o documento: ter, form ou residencia." }, 400);

  const slot = officialDocSlot(protocol, doc);
  if (slot.status !== "available") {
    console.info("[ceaf/official]", { protocolId: protocol, doc, status: 404, reason: slot.reason });
    return jsonUtf8(
      { error: "Não foi possível localizar o documento oficial deste protocolo. Tente novamente ou informe o suporte." },
      404,
    );
  }

  try {
    const built = await buildOfficialCeafPdf(protocol, doc, {
      name: searchParams.get("name") || "",
      doctor: searchParams.get("doctor") || "",
      crm: searchParams.get("crm") || "",
      date: searchParams.get("date") || "",
      cpf: searchParams.get("cpf") || "",
      birth: searchParams.get("birth") || "",
    });
    const fname = asciiName(protocol || "ceaf", doc);
    console.info("[ceaf/official]", { protocolId: protocol, doc, status: 200, pages: built.pages });
    return new NextResponse(new Uint8Array(built.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fname}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const tried = err && typeof err === "object" && "tried" in err ? (err as { tried?: string[] }).tried : undefined;
    console.error("[ceaf/official]", { protocolId: protocol, doc, status: 500, path: tried, error: "falha ao ler/gerar" });
    return jsonUtf8({ error: "Não foi possível gerar o documento oficial." }, 500);
  }
}
