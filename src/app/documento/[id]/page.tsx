"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <button type="button" className="btn-gold" onClick={() => window.print()}>
          Imprimir / salvar PDF
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
