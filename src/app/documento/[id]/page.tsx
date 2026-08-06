"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { whatsappLink } from "@/lib/contact";

type Doc = {
  id: string;
  type: "receita" | "exame" | "relatorio";
  title: string;
  body: string;
  doctorName: string;
  doctorCrm?: string | null;
  patientEmail: string;
  createdAt: string;
};

const TYPE_LABEL: Record<Doc["type"], string> = {
  receita: "Receita médica",
  exame: "Solicitação de exames",
  relatorio: "Relatório médico",
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

  async function downloadPdf() {
    if (!doc) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Meu Rim", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text("Nefrologia online", margin, y + 15);
    pdf.text(date, pageW - margin, y, { align: "right" });
    pdf.setTextColor(20);
    y += 40;
    pdf.setDrawColor(210);
    pdf.line(margin, y, pageW - margin, y);
    y += 34;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text((doc.title || TYPE_LABEL[doc.type]).toUpperCase(), pageW / 2, y, { align: "center" });
    y += 30;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(doc.body, maxW) as string[];
    for (const line of lines) {
      if (y > 720) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 20;
    }

    y = Math.max(y + 60, 700);
    pdf.line(margin + 120, y, pageW - margin - 120, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.doctorName, pageW / 2, y + 16, { align: "center" });
    if (doc.doctorCrm) {
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120);
      pdf.text(doc.doctorCrm, pageW / 2, y + 32, { align: "center" });
    }

    pdf.save(`${doc.type}-meu-rim.pdf`);
  }

  function shareWhatsApp() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const label = TYPE_LABEL[doc!.type];
    const msg = `${label} — Meu Rim (${doc!.doctorName}).\nAbra o documento: ${url}`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <button type="button" className="btn-gold" onClick={downloadPdf}>
          Baixar PDF
        </button>
        <button type="button" className="btn-ghost" onClick={shareWhatsApp}>
          Enviar no WhatsApp
        </button>
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      <div className="rounded-[16px] border border-[var(--border)] bg-white p-8 shadow-[var(--shadow)] print:border-0 print:shadow-none">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gold)] text-sm font-extrabold text-white">
              MR
            </span>
            <div>
              <p className="font-display text-lg font-extrabold text-[var(--text)]">Meu Rim</p>
              <p className="text-xs text-[var(--text-muted)]">Nefrologia online</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{date}</p>
        </div>

        <h1 className="mt-6 text-center text-xl font-extrabold uppercase tracking-wide text-[var(--text)]">
          {doc.title || TYPE_LABEL[doc.type]}
        </h1>

        <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text)]">
          {doc.body}
        </div>

        {/* Assinatura */}
        <div className="mt-16 border-t border-[var(--text)] pt-2 text-center">
          <p className="font-semibold text-[var(--text)]">{doc.doctorName}</p>
          {doc.doctorCrm && <p className="text-sm text-[var(--text-muted)]">{doc.doctorCrm}</p>}
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--text-muted)]">
          Documento emitido pela plataforma Meu Rim. Em emergência, procure atendimento presencial.
        </p>
      </div>
    </div>
  );
}
