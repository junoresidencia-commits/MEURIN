import { getDoctorSessionId } from "@/lib/auth";
import { getLme } from "@/lib/lme-store";
import { getDocuments } from "@/lib/patient-store";
import { jsonUtf8 } from "@/lib/json-utf8";
import {
  inferProtocolId,
  officialConsentimentoSlot,
  officialTerSlot,
  packageMissingLabels,
  type ComplementarySlot,
} from "@/lib/complementary-docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFromDoc(doc: { pdfPath?: string | null; status?: string | null } | undefined, hasDraft: boolean): ComplementarySlot["status"] {
  if (doc?.pdfPath && doc.status !== "draft") return "gerado";
  if (doc || hasDraft) return "rascunho";
  return "nao_gerado";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const doctorId = await getDoctorSessionId();
  if (!doctorId) return jsonUtf8({ error: "Não autenticado." }, 401);
  const { id } = await params;
  const lme = await getLme(id);
  if (!lme) return jsonUtf8({ error: "LME não encontrada." }, 404);
  if (lme.doctorId && lme.doctorId !== doctorId) return jsonUtf8({ error: "Sem acesso." }, 403);

  const docs = await getDocuments(lme.patientEmail);
  const linked = docs.filter((d) => d.sourceLmeId === id);
  const byType = (type: string) =>
    linked.find((d) => d.type === type) ||
    docs.find((d) => d.type === type && !d.sourceLmeId);

  const protocolId = inferProtocolId(lme);
  const protocolName = protocolId ? (await import("@/lib/ceaf-catalog")).getProtocol(protocolId)?.name : null;
  const terOfficial = officialTerSlot(protocolId);
  const consentOfficial = officialConsentimentoSlot(protocolId);

  const receitaDoc = byType("receita");
  const relatorioDoc = byType("relatorio");
  const terDoc = linked.find((d) => d.type === "ter");

  const slots: ComplementarySlot[] = [
    {
      kind: "receita",
      label: "Receita",
      status: statusFromDoc(receitaDoc, false),
      docId: receitaDoc?.id ?? null,
      pdfUrl: receitaDoc?.pdfPath ? `/api/documents/${receitaDoc.id}/pdf` : null,
    },
    {
      kind: "relatorio",
      label: "Relatório médico",
      status: statusFromDoc(relatorioDoc, false),
      docId: relatorioDoc?.id ?? null,
      pdfUrl: relatorioDoc?.pdfPath ? `/api/documents/${relatorioDoc.id}/pdf` : null,
    },
    {
      kind: "ter",
      label: "Termo de responsabilidade (TER oficial)",
      officialLabel: terOfficial.status === "available" ? terOfficial.label : undefined,
      status: terOfficial.status !== "available" ? "indisponivel" : statusFromDoc(terDoc, false),
      reason: terOfficial.status === "unavailable" ? terOfficial.reason : undefined,
      docId: terDoc?.id ?? null,
      pdfUrl: terDoc?.pdfPath ? `/api/documents/${terDoc.id}/pdf` : null,
    },
    {
      kind: "consentimento",
      label: "Termo de consentimento",
      officialLabel: consentOfficial.label,
      status: "indisponivel",
      reason: consentOfficial.status === "unavailable" ? consentOfficial.reason : undefined,
    },
  ];

  const missing = packageMissingLabels(slots.filter((s) => s.status !== "indisponivel"));
  const packageReady = missing.length === 0 && slots.some((s) => s.kind === "ter" && s.status === "gerado");

  return jsonUtf8({
    lmeId: id,
    protocolId,
    protocolName: protocolName || null,
    slots,
    missing,
    packageReady,
    packageNote: packageReady
      ? "Pacote com LME, receita, relatório e TER oficial."
      : missing.length
        ? `Ainda faltam: ${missing.join(", ")}. O pacote só fica completo depois de gerar estes itens.`
        : terOfficial.status === "unavailable"
          ? `TER oficial indisponível neste protocolo: ${terOfficial.reason}`
          : "Gere o TER oficial para completar o pacote.",
  });
}
