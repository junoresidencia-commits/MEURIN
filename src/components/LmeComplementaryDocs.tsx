"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { composerHref, type ComplementarySlot } from "@/lib/complementary-docs";
import { CfmPdfActions } from "@/components/CfmPdfActions";

type Info = {
  protocolId: string | null;
  protocolName: string | null;
  slots: ComplementarySlot[];
  missing: string[];
  packageReady: boolean;
  packageNote: string;
};

const STATUS_LABEL: Record<ComplementarySlot["status"], string> = {
  nao_gerado: "Não gerado",
  rascunho: "Rascunho",
  gerado: "Gerado",
  indisponivel: "Indisponível",
};

export function LmeComplementaryDocs({
  lmeId,
  patientEmail,
}: {
  lmeId: string;
  patientEmail: string;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/lme/${lmeId}/complementares`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Não foi possível carregar os documentos.");
    setInfo(d);
  }, [lmeId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [load]);

  async function gerarTer() {
    setBusy("ter");
    setError("");
    try {
      const r = await fetch(`/api/lme/${lmeId}/oficial-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ter" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível gerar o TER oficial.");
      await load();
      if (d.pdfUrl) window.open(d.pdfUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  const receita = info?.slots.find((s) => s.kind === "receita");
  const relatorio = info?.slots.find((s) => s.kind === "relatorio");
  const ter = info?.slots.find((s) => s.kind === "ter");
  const consent = info?.slots.find((s) => s.kind === "consentimento");

  return (
    <section id="complementares" className="mt-6 scroll-mt-6 rounded-[16px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-5 shadow-[var(--shadow)] print:hidden">
      <h2 className="font-display text-lg font-extrabold text-[var(--text)]">Documentos complementares</h2>
      <p className="mt-1 text-sm text-[var(--text-soft)]">
        Cada documento sai separado: receita, relatório e TER. A LME oficial <b>não é misturada</b>.
        {info?.protocolName ? <> Protocolo: <b>{info.protocolName}</b>.</> : null}
      </p>

      <div className="mt-3 grid gap-2">
        <DocRow
          slot={receita}
          action={
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Link href={composerHref(patientEmail, { type: "receita", title: "Receita médica" }, lmeId)} className="btn-gold text-sm">
                  {receita?.status === "nao_gerado" ? "Gerar receita" : "Revisar"}
                </Link>
              </div>
              {receita?.pdfUrl && (
                <CfmPdfActions
                  compact
                  pdfHref={receita.pdfUrl}
                  documentId={receita.docId}
                  patientKey={patientEmail}
                  documentType="receita"
                  title="Receita médica"
                  filename="receita-meurim.pdf"
                />
              )}
            </div>
          }
        />
        <DocRow
          slot={relatorio}
          action={
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Link href={composerHref(patientEmail, { type: "relatorio", title: "Relatório médico" }, lmeId)} className="btn-ghost text-sm">
                  {relatorio?.status === "nao_gerado" ? "Gerar relatório" : "Revisar"}
                </Link>
              </div>
              {relatorio?.pdfUrl && (
                <CfmPdfActions
                  compact
                  pdfHref={relatorio.pdfUrl}
                  documentId={relatorio.docId}
                  patientKey={patientEmail}
                  documentType="relatorio"
                  title="Relatório médico"
                  filename="relatorio-meurim.pdf"
                />
              )}
            </div>
          }
        />
        <DocRow
          slot={ter}
          action={
            ter?.status === "indisponivel" ? null : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-sm" onClick={() => void gerarTer()} disabled={busy === "ter"}>
                    {busy === "ter" ? "Preparando…" : ter?.status === "gerado" ? "Gerar TER novamente" : "Gerar TER"}
                  </button>
                </div>
                {ter?.pdfUrl && (
                  <CfmPdfActions
                    compact
                    pdfHref={ter.pdfUrl}
                    documentId={ter.docId}
                    patientKey={patientEmail}
                    documentType="ter"
                    title="TER oficial"
                    filename="ter-oficial.pdf"
                  />
                )}
              </div>
            )
          }
        />
        <DocRow slot={consent} />
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
    </section>
  );
}

function DocRow({ slot, action }: { slot?: ComplementarySlot; action?: ReactNode }) {
  if (!slot) return null;
  const color =
    slot.status === "gerado" ? "bg-[#eaf8f2] text-[#1c8c70]"
    : slot.status === "rascunho" ? "bg-[#fff3e2] text-[#e08a2e]"
    : slot.status === "indisponivel" ? "bg-[var(--border)] text-[var(--text-muted)]"
    : "bg-white text-[var(--text-muted)]";
  return (
    <div className="rounded-xl border border-[var(--border-gold)]/50 bg-white/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text)]">{slot.label}</p>
          {slot.officialLabel && <p className="text-xs text-[var(--text-muted)]">{slot.officialLabel}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${color}`}>{STATUS_LABEL[slot.status]}</span>
      </div>
      {slot.reason && <p className="mt-1 text-xs text-[var(--text-muted)]">{slot.reason}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
