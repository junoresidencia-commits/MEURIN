"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type Doc = {
  id: string; type: string; title: string; doctorName: string; createdAt: string;
  status: string; signed: boolean; pdfUrl: string | null; viewUrl: string;
};

const TYPE_LABEL: Record<string, string> = {
  receita: "Receita", exame: "Pedido de exames", relatorio: "Relatório", atestado: "Atestado",
  declaracao: "Declaração", encaminhamento: "Encaminhamento", parecer: "Parecer",
  orientacao: "Orientações", laudo: "Laudo", livre: "Documento",
};

export default function MeusDocumentosPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);

  useEffect(() => {
    fetch("/api/patient/documents")
      .then((r) => { if (r.status === 401) { router.replace("/paciente/entrar"); return null; } return r.json(); })
      .then((d) => { if (d) setDocs(d.documents || []); })
      .catch(() => setDocs([]));
  }, [router]);

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Meus documentos</h1>
        <Link href="/paciente/inicio" className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">Início</Link>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Documentos que seu médico disponibilizou para você.</p>

      <div className="mt-5 grid gap-3">
        {docs === null && <p className="text-[var(--text-muted)]">Carregando…</p>}
        {docs && docs.length === 0 && (
          <p className="rounded-2xl border border-[var(--border)] bg-white px-4 py-10 text-center text-[var(--text-muted)]">
            Nenhum documento disponível ainda.
          </p>
        )}
        {docs?.map((d) => (
          <div key={d.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--gold)]">{TYPE_LABEL[d.type] || "Documento"}</span>
              {d.signed && <span className="text-xs font-semibold text-emerald-600">Assinado</span>}
            </div>
            <p className="mt-2 font-semibold text-[var(--text)]">{d.title}</p>
            <p className="text-sm text-[var(--text-muted)]">{d.doctorName} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={d.viewUrl} target="_blank" rel="noopener noreferrer" className="btn-gold text-sm">Visualizar</a>
              {d.pdfUrl && <a href={d.pdfUrl} download className="btn-ghost text-sm">Baixar PDF</a>}
            </div>
          </div>
        ))}
      </div>
      <PatientNav />
    </div>
  );
}
