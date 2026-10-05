"use client";

import { useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  authorRole: string;
  authorName: string;
  body: string;
  attachmentName?: string | null;
  createdAt: string;
};

export function ReturnRequestChat({ requestId, chatOpen }: { requestId: string; chatOpen: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/return-requests/${requestId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
  }
  useEffect(() => { load(); }, [requestId]);
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [requestId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!body.trim() && !fileRef.current?.files?.[0]) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("body", body);
      const f = fileRef.current?.files?.[0];
      if (f) form.append("file", f);
      const res = await fetch(`/api/return-requests/${requestId}/messages`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível enviar.");
      setBody("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Conversa deste atendimento</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Vinculada a esta solicitação — não é um WhatsApp aberto.</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.authorRole === "patient" ? "bg-[var(--gold-soft)]" : m.authorRole === "system" ? "bg-[var(--bg)] text-[var(--text-muted)]" : "bg-white border border-[var(--border)]"}`}>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">{m.authorName} · {new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
            {m.body && <p className="mt-0.5 whitespace-pre-wrap text-[var(--text)]">{m.body}</p>}
            {m.attachmentName && <p className="mt-1 text-xs font-semibold text-[var(--gold)]">📎 {m.attachmentName}</p>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {chatOpen ? (
        <div className="mt-3 space-y-2">
          <textarea className="input-field min-h-[72px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva uma mensagem…" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer text-sm">
              Anexar documento
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.heic,.pdf" className="hidden" />
            </label>
            <button type="button" className="btn-gold text-sm" disabled={busy} onClick={send}>{busy ? "Enviando…" : "Enviar"}</button>
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-muted)]">Atendimento concluído. O chat foi arquivado. Para uma nova demanda, abra um novo atendimento.</p>
      )}
    </div>
  );
}
