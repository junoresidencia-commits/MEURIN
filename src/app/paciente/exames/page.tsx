"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientNav } from "@/components/PatientNav";

type Upload = {
  id: string;
  name: string;
  category?: string | null;
  examDate?: string | null;
  createdAt: string;
  signedUrl?: string | null;
};

export default function PacienteExamesPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [category, setCategory] = useState("Exame laboratorial");
  const [examDate, setExamDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/patient/exams");
    if (res.status === 401) {
      router.replace("/paciente/entrar?next=/paciente/exames");
      return;
    }
    const data = await res.json();
    setUploads(data.uploads || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo (foto ou PDF).");
      return;
    }
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      if (examDate) form.append("examDate", examDate);
      const res = await fetch("/api/patient/exams", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no envio.");
      if (fileRef.current) fileRef.current.value = "";
      setExamDate("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Início</Link>
      <h1 className="font-display mt-3 text-2xl font-extrabold text-[var(--text)]">Meus exames</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Envie fotos ou PDF dos seus exames para o seu médico ver no prontuário.
      </p>

      <div className="panel mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Arquivo (foto ou PDF)</span>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="block w-full text-sm text-[var(--text-soft)]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Categoria</span>
            <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Exame laboratorial</option>
              <option>Exame de imagem</option>
              <option>Laudo</option>
              <option>Receita antiga</option>
              <option>Documento</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Data do exame</span>
            <input type="date" className="input-field" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        )}
        <button type="button" className="btn-gold w-full" onClick={send} disabled={sending}>
          {sending ? "Enviando…" : "Enviar exame"}
        </button>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Enviados</p>
      <div className="mt-3 space-y-3">
        {loading && <p className="text-[var(--text-muted)]">Carregando…</p>}
        {!loading && uploads.length === 0 && <p className="text-[var(--text-muted)]">Nenhum exame enviado ainda.</p>}
        {uploads.map((u) => (
          <div key={u.id} className="panel flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--text)]">{u.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {[u.category, u.examDate ? new Date(u.examDate).toLocaleDateString("pt-BR") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {u.signedUrl && (
              <a href={u.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-[var(--gold)]">
                Abrir
              </a>
            )}
          </div>
        ))}
      </div>

      <PatientNav />
    </div>
  );
}
