"use client";

import { useEffect, useState } from "react";

type LetterheadOpt = {
  id: string;
  name: string;
  isDefault?: boolean;
  active?: boolean;
};

type Med = { name: string; presentation: string; quantity: string; posology: string };

const DOC_TYPES = [
  { id: "receita", label: "Receita" },
  { id: "exame", label: "Pedido de exames" },
  { id: "relatorio", label: "Relatório" },
  { id: "evolucao", label: "Evolução (PDF)" },
  { id: "parecer", label: "Parecer" },
  { id: "atestado", label: "Atestado" },
  { id: "declaracao", label: "Declaração" },
  { id: "encaminhamento", label: "Encaminhamento" },
  { id: "orientacao", label: "Orientações" },
  { id: "livre", label: "Documento livre" },
] as const;

export function DocumentComposer({
  patientKey,
  patientName,
  patientCpf,
  initialType = "receita",
  initialTitle = "",
  initialBody = "",
  onSaved,
}: {
  patientKey: string;
  patientName?: string;
  patientCpf?: string;
  initialType?: string;
  initialTitle?: string;
  initialBody?: string;
  onSaved?: (docId: string) => void;
}) {
  const [type, setType] = useState(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [letterheads, setLetterheads] = useState<LetterheadOpt[]>([]);
  const [letterheadId, setLetterheadId] = useState("none");
  const [meds, setMeds] = useState<Med[]>([{ name: "", presentation: "", quantity: "", posology: "" }]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [shareOnSave, setShareOnSave] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctor/letterheads")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.letterheads || []).filter((l: LetterheadOpt) => l.active !== false);
        setLetterheads(list);
        const def = list.find((l: LetterheadOpt) => l.isDefault);
        if (def) setLetterheadId(def.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setType(initialType);
    setTitle(initialTitle);
    setBody(initialBody);
  }, [initialType, initialTitle, initialBody]);

  function payload(action: "preview" | "save") {
    return {
      action,
      patientKey,
      patientName,
      patientCpf,
      type,
      title: title || undefined,
      body,
      letterheadId,
      medications: type === "receita" ? meds.filter((m) => m.name.trim()) : undefined,
      sharedWithPatient: shareOnSave,
      signOnGenerate: true,
    };
  }

  async function preview() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/doctor/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload("preview")),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na prévia");
      setPreviewUrl(data.pdfData);
      setMsg("Prévia gerada com o papel timbrado real.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function save(share?: boolean) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/doctor/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload("save"), sharedWithPatient: share ?? shareOnSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setPreviewUrl(data.pdfData || null);
      setLastDocId(data.document?.id || null);
      setMsg(
        share || shareOnSave
          ? "PDF salvo no prontuário e disponibilizado ao paciente."
          : "PDF salvo no prontuário (ainda não visível ao paciente)."
      );
      onSaved?.(data.document.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function shareNow() {
    if (!lastDocId) {
      await save(true);
      return;
    }
    if (!confirm("Este documento ficará disponível na área do paciente.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/doctor/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share", documentId: lastDocId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      setMsg("Disponibilizado ao paciente.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Novo documento</p>
        <p className="text-sm text-[var(--text-soft)]">
          Paciente: <b>{patientName || "—"}</b>
          {patientCpf ? ` · CPF ${patientCpf}` : ""}
        </p>

        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                type === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Papel timbrado</span>
          <select className="input-field" value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)}>
            <option value="none">Sem papel timbrado</option>
            {letterheads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.isDefault ? " (padrão)" : ""}
              </option>
            ))}
          </select>
          <a href="/medicos/configuracoes/documentos" className="mt-1 inline-block text-xs font-semibold text-[var(--gold)]">
            Alterar / cadastrar papéis timbrados →
          </a>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Título</span>
          <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opcional" />
        </label>

        {type === "receita" && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicamentos</p>
            {meds.map((m, i) => (
              <div key={i} className="rounded-2xl border border-[var(--border)] p-3 space-y-2">
                <input
                  className="input-field"
                  placeholder="Medicamento"
                  value={m.name}
                  onChange={(e) => setMeds((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input-field"
                    placeholder="Apresentação"
                    value={m.presentation}
                    onChange={(e) => setMeds((arr) => arr.map((x, j) => (j === i ? { ...x, presentation: e.target.value } : x)))}
                  />
                  <input
                    className="input-field"
                    placeholder="Quantidade"
                    value={m.quantity}
                    onChange={(e) => setMeds((arr) => arr.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                  />
                </div>
                <input
                  className="input-field"
                  placeholder="Posologia"
                  value={m.posology}
                  onChange={(e) => setMeds((arr) => arr.map((x, j) => (j === i ? { ...x, posology: e.target.value } : x)))}
                />
                {meds.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--danger)]"
                    onClick={() => setMeds((arr) => arr.filter((_, j) => j !== i))}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-semibold text-[var(--gold)]"
              onClick={() => setMeds((arr) => [...arr, { name: "", presentation: "", quantity: "", posology: "" }])}
            >
              + Adicionar medicamento
            </button>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">
            {type === "receita" ? "Orientações / texto livre" : "Conteúdo"}
          </span>
          <textarea
            className="input-field min-h-[140px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Use {{paciente_nome}}, {{medico_crm}}, {{data_atual}}…"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
          <input type="checkbox" checked={shareOnSave} onChange={(e) => setShareOnSave(e.target.checked)} />
          Disponibilizar ao paciente ao salvar
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={busy} onClick={preview}>
            Pré-visualizar
          </button>
          <button type="button" className="btn-gold" disabled={busy} onClick={() => save(false)}>
            {busy ? "Gerando…" : "Gerar PDF e salvar no prontuário"}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={shareNow}>
            Disponibilizar ao paciente
          </button>
        </div>
        {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
      </div>

      {previewUrl && (
        <div className="panel">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Prévia do PDF final</p>
          <iframe title="Prévia do documento" src={previewUrl} className="h-[70vh] w-full rounded-xl border border-[var(--border)]" />
          <a href={previewUrl} download={`${title || type}.pdf`} className="mt-3 inline-block text-sm font-semibold text-[var(--gold)]">
            Baixar PDF →
          </a>
        </div>
      )}
    </div>
  );
}
