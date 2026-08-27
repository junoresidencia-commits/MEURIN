"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { id: string; sender: "patient" | "professional"; body: string; createdAt: string };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CareMessageThread({
  role,
  professionalId,
  patientKey,
  viewer,
  title,
}: {
  role: string;
  professionalId?: string;
  patientKey?: string;
  viewer: "patient" | "professional";
  title?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function load() {
    const q = new URLSearchParams({ role });
    if (professionalId) q.set("professionalId", professionalId);
    if (patientKey) q.set("patientKey", patientKey);
    const res = await fetch(`/api/care-messages?${q.toString()}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setMessages(d.messages || []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, professionalId, patientKey]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/care-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, professionalId, patientKey, body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível enviar.");
      setText("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  const mine = viewer === "patient" ? "patient" : "professional";

  return (
    <div id="mensagens" className="mt-3">
      {title && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{title}</p>}
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        {messages.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma mensagem ainda. Escreva abaixo para começar.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${m.sender === mine ? "ml-auto bg-[var(--gold-soft)] text-[var(--text)]" : "bg-white text-[var(--text)]"}`}>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">{fmt(m.createdAt)}</p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="mt-2 flex gap-2">
        <textarea
          className="input-field min-h-[44px] flex-1"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={viewer === "patient" ? "Escreva para o profissional…" : "Responder o paciente…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button type="button" className="btn-gold self-end" onClick={send} disabled={saving || !text.trim()}>{saving ? "…" : "Enviar"}</button>
      </div>
      {err && <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{err}</p>}
    </div>
  );
}
