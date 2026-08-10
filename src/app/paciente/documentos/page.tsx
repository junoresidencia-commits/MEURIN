"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type Doc = {
  id: string;
  type: string;
  title: string;
  doctorName: string;
  createdAt: string;
  sharedWithPatient?: boolean;
  status?: string;
  signatureMethod?: string | null;
};

const CATEGORIES: { id: string; label: string; types: string[] }[] = [
  { id: "todos", label: "Todos", types: [] },
  { id: "receitas", label: "Receitas", types: ["receita"] },
  { id: "exames", label: "Pedidos de exames", types: ["exame"] },
  { id: "relatorios", label: "Relatórios", types: ["relatorio", "resumo", "parecer"] },
  { id: "evolucoes", label: "Evoluções", types: ["evolucao"] },
  { id: "orientacoes", label: "Orientações", types: ["orientacao", "plano"] },
  { id: "atestados", label: "Atestados", types: ["atestado", "declaracao"] },
  { id: "encaminhamentos", label: "Encaminhamentos", types: ["encaminhamento", "carta"] },
  { id: "outros", label: "Outros", types: ["livre", "pronto", "laudo", "termo", "lme", "alta"] },
];

const TYPE_LABEL: Record<string, string> = {
  receita: "Receita médica",
  exame: "Pedido de exames",
  relatorio: "Relatório médico",
  evolucao: "Evolução",
  parecer: "Parecer",
  atestado: "Atestado",
  declaracao: "Declaração",
  encaminhamento: "Encaminhamento",
  orientacao: "Orientações",
  livre: "Documento",
  pronto: "Documento anexado",
};

export default function PacienteDocumentosPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("todos");

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/documents");
    if (res.status === 401) {
      router.replace("/paciente/entrar");
      return;
    }
    const data = await res.json();
    setDocs(data.documents || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (cat === "todos") return docs;
    const types = CATEGORIES.find((c) => c.id === cat)?.types || [];
    return docs.filter((d) => types.includes(d.type));
  }, [docs, cat]);

  if (loading) {
    return <div className="mx-auto max-w-[560px] px-5 py-10 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">
        ← Início
      </Link>
      <h1 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)]">Meus Documentos</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Documentos disponibilizados pelo seu médico — visualização e download do PDF final.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              cat === c.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="panel text-sm text-[var(--text-muted)]">
            Nenhum documento nesta categoria ainda.
          </div>
        )}
        {filtered.map((d) => (
          <div key={d.id} className="panel">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">
              {TYPE_LABEL[d.type] || d.type}
            </p>
            <p className="mt-1 font-bold text-[var(--text)]">{d.title}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {new Date(d.createdAt).toLocaleDateString("pt-BR")} · {d.doctorName}
              {d.signatureMethod ? " · assinado" : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/documento/${d.id}`} className="btn-gold">
                Visualizar PDF
              </a>
              <a href={`/documento/${d.id}`} className="btn-ghost" target="_blank" rel="noopener noreferrer">
                Baixar PDF
              </a>
            </div>
          </div>
        ))}
      </div>

      <PatientNav />
    </div>
  );
}
