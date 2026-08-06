"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Med = { name: string; presentation: string; monthlyQty: string };
type Protocol = {
  id: string;
  name: string;
  cid10?: string | null;
  medications: { name: string }[];
  requiredExams: string[];
  requiredDocuments: string[];
  active: boolean;
};

export default function AdminProtocolosPage() {
  const router = useRouter();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [cid10, setCid10] = useState("");
  const [meds, setMeds] = useState<Med[]>([{ name: "", presentation: "", monthlyQty: "" }]);
  const [exams, setExams] = useState("");
  const [docs, setDocs] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/protocols");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setProtocols(data.protocols || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!name.trim()) {
      setMsg("Informe o nome do protocolo.");
      return;
    }
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/protocols", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        cid10,
        medications: meds.filter((m) => m.name.trim()),
        requiredExams: exams,
        requiredDocuments: docs,
        source,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setName(""); setCid10(""); setMeds([{ name: "", presentation: "", monthlyQty: "" }]); setExams(""); setDocs(""); setSource("");
      setMsg("Protocolo salvo.");
      await load();
    } else {
      setMsg(data.error || "Falha ao salvar.");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este protocolo?")) return;
    await fetch(`/api/admin/protocols?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Protocolos do CEAF</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Cadastre os protocolos mais comuns. No prontuário, o médico seleciona o protocolo e a LME é pré-preenchida.
      </p>

      <div className="panel mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome do protocolo / doença</span>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hiperparatireoidismo secundário" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CID-10</span>
            <input className="input-field" value={cid10} onChange={(e) => setCid10(e.target.value)} placeholder="Ex.: N25.8" />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-[var(--text-muted)]">Medicamentos (DCB)</span>
          {meds.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input className="input-field" placeholder="Nome (DCB)" value={m.name} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input-field" placeholder="Apresentação" value={m.presentation} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, presentation: e.target.value } : x)))} />
              <input className="input-field" placeholder="Qtde/mês" value={m.monthlyQty} onChange={(e) => setMeds((a) => a.map((x, j) => (j === i ? { ...x, monthlyQty: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-[var(--gold)]" onClick={() => setMeds((a) => [...a, { name: "", presentation: "", monthlyQty: "" }])}>
            + Adicionar medicamento
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Exames exigidos (um por linha)</span>
          <textarea className="input-field min-h-[70px]" value={exams} onChange={(e) => setExams(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Documentos exigidos (um por linha)</span>
          <textarea className="input-field min-h-[70px]" value={docs} onChange={(e) => setDocs(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Fonte / referência</span>
          <input className="input-field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex.: PCDT vigente" />
        </label>

        {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
        <button type="button" className="btn-gold" onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Salvando…" : "Salvar protocolo"}
        </button>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Protocolos cadastrados</p>
      <div className="mt-3 space-y-3">
        {protocols.length === 0 && <p className="text-[var(--text-muted)]">Nenhum protocolo ainda.</p>}
        {protocols.map((p) => (
          <div key={p.id} className="panel flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[var(--text)]">{p.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                CID {p.cid10 || "—"} · {p.medications.length} medicamento(s) · {p.requiredExams.length} exame(s) · {p.requiredDocuments.length} doc(s)
              </p>
            </div>
            <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={() => remove(p.id)}>
              Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
