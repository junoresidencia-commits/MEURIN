"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { whatsappLink } from "@/lib/contact";

type Doc = {
  id: string;
  type: string;
  title: string;
  body: string;
  doctorName: string;
  doctorCrm?: string | null;
  doctorLogoUrl?: string | null;
  patientEmail: string;
  createdAt: string;
  hasPdf?: boolean;
  pdfData?: string | null;
  status?: string;
  signatureMethod?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  receita: "Receita médica",
  exame: "Solicitação de exames",
  relatorio: "Relatório médico",
  evolucao: "Evolução médica",
  livre: "Documento",
};

export default function DocumentoPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/documento/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Erro");
        setDoc(data.document);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--danger)]">{error}</div>;
  }
  if (!doc) {
    return <div className="mx-auto max-w-2xl px-5 py-20 text-[var(--text-muted)]">Carregando documento…</div>;
  }

  const date = new Date(doc.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function downloadPdf() {
    if (!doc) return;
    if (doc.pdfData) {
      const a = document.createElement("a");
      a.href = doc.pdfData;
      a.download = `${doc.type}-${doc.id.slice(0, 8)}.pdf`;
      a.click();
      return;
    }
    void legacyDownload();
  }

  async function legacyDownload() {
    if (!doc) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(doc.doctorName, margin, y);
    y += 20;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(doc.title || TYPE_LABEL[doc.type] || "Documento", margin, y);
    y += 24;
    const lines = pdf.splitTextToSize(doc.body, maxW) as string[];
    for (const line of lines) {
      if (y > 760) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 16;
    }
    pdf.save(`${doc.type}-meu-rim.pdf`);
  }

  function shareWhatsApp() {
    if (!doc) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const label = TYPE_LABEL[doc.type] || doc.title;
    const msg = `${label} — Meu Rim (${doc.doctorName}).\nAbra o documento: ${url}`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <button type="button" className="btn-gold" onClick={downloadPdf}>
          Baixar PDF
        </button>
        <button type="button" className="btn-ghost" onClick={shareWhatsApp}>
          Enviar no WhatsApp
        </button>
        {!doc.pdfData && (
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            Imprimir
          </button>
        )}
      </div>

      {doc.pdfData ? (
        <div className="panel">
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            {doc.title} · {date} · {doc.doctorName}
            {doc.signatureMethod ? " · assinado (rubrica eletrônica)" : ""}
          </p>
          <iframe title="Documento PDF" src={doc.pdfData} className="h-[80vh] w-full rounded-xl border border-[var(--border)]" />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)] print:border-0 print:shadow-none">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              {doc.doctorLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.doctorLogoUrl} alt="Logo do médico" className="h-12 max-w-[160px] object-contain" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold)] text-sm font-extrabold text-white">
                  MR
                </span>
              )}
              <div>
                <p className="font-display text-lg font-extrabold text-[var(--text)]">Meu Rim</p>
                <p className="text-xs text-[var(--text-muted)]">Documento clínico</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)]">{date}</p>
          </div>

          <h1 className="mt-6 text-center text-xl font-extrabold uppercase tracking-wide text-[var(--text)]">
            {doc.title || TYPE_LABEL[doc.type]}
          </h1>

          <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text)]">{doc.body}</div>

          <div className="mt-16 border-t border-[var(--text)] pt-2 text-center">
            <p className="font-semibold text-[var(--text)]">{doc.doctorName}</p>
            {doc.doctorCrm && <p className="text-sm text-[var(--text-muted)]">{doc.doctorCrm}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
