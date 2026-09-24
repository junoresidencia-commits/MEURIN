"use client";

import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_ALERT_LABEL, HD_EXAM_LABEL } from "@/lib/hd-labels";

type Item = {
  patientId: string;
  patientName: string;
  machine: string;
  status: "OK" | "REVISAR" | "CRITICO";
  alerts: Array<{ message: string; suggestion: string; level: string }>;
  labs: Record<string, number | null>;
  prescription: Record<string, string>;
  suggestion: string;
  trends: Record<string, Array<{ value: number }>>;
};

export default function HdRevisaoPage() {
  const { year, month, shift, can } = useHd();
  const [items, setItems] = useState<Item[]>([]);
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState("");
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [reviewed, setReviewed] = useState(0);
  const [total, setTotal] = useState(0);

  async function load() {
    const u = new URLSearchParams({ view: "review", year: String(year), month: String(month), shift });
    const d = await fetch(`/api/hemodialise?${u}`).then((r) => r.json());
    setItems(d.items || []);
    setReviewed(d.reviewed || 0);
    setTotal(d.total || 0);
    setI(0);
    setNotes("");
    setChanges({});
  }
  useEffect(() => { load(); }, [year, month, shift]);

  const cur = items[i];

  async function decide(decision: "manter" | "alterar" | "aguardar") {
    if (!cur) return;
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        patientId: cur.patientId,
        decision,
        notes,
        year,
        month,
        changes: decision === "alterar" ? changes : undefined,
      }),
    });
    const d = await r.json();
    if (d.error) {
      setMsg(d.error);
      return;
    }
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    setI(Math.min(i, Math.max(0, next.length - 1)));
    setNotes("");
    setChanges({});
    setReviewed((n) => n + 1);
    setMsg(next.length === 0 ? "Fila concluída." : "");
  }

  async function closeMonth() {
    const r = await fetch("/api/hemodialise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close_month", year, month }),
    });
    const d = await r.json();
    setMsg(d.error || "Mês fechado. Alterações passam a exigir justificativa.");
  }

  if (!can("review")) return <p>Somente médicos autorizados revisam condutas.</p>;
  if (!cur) {
    return (
      <div className="panel">
        <h2 className="font-display text-2xl font-extrabold">Resolver pendências</h2>
        <p className="mt-2 text-sm">Nada na fila. {reviewed}/{total} revisados.</p>
        {can("close_month") && reviewed > 0 && (
          <button type="button" className="btn-gold mt-4" onClick={closeMonth}>Fechar mês</button>
        )}
        {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">Paciente {i + 1} de {items.length} · {reviewed}/{total} revisados no mês</p>
      <h2 className="font-display text-3xl font-extrabold">{cur.patientName}</h2>
      <p className="text-sm">Máq {cur.machine} · <span className={cur.status === "CRITICO" ? "font-bold text-[var(--danger)]" : ""}>{HD_ALERT_LABEL[cur.status]}</span></p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <p className="font-bold">Exames e tendência</p>
          {["hb", "p", "pth"].map((c) => (
            <p key={c} className="mt-2 text-sm">
              {HD_EXAM_LABEL[c as keyof typeof HD_EXAM_LABEL]}: <strong>{cur.labs[c] ?? "—"}</strong>
              <span className="ml-2 text-[var(--text-muted)]">{(cur.trends[c] || []).map((t) => t.value).join(" → ")}</span>
            </p>
          ))}
        </div>
        <div className="panel">
          <p className="font-bold">Prescrição atual</p>
          {Object.entries(cur.prescription).map(([k, v]) => (
            <label key={k} className="mt-1 block text-sm">
              {k}
              <input className="mt-0.5 w-full rounded-lg border border-[var(--border)] px-2 py-1" value={changes[k] ?? v} onChange={(e) => setChanges({ ...changes, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>
      <div className="panel mt-4">
        <p className="font-bold">Situação identificada</p>
        <p className="text-sm">{cur.alerts.map((a) => a.message).join(" · ") || "Sem alerta."}</p>
        <p className="mt-2 font-bold">Sugestão do protocolo</p>
        <p className="text-sm">{cur.suggestion}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">IA detecta · protocolo interpreta · médico decide. Nada é aplicado sozinho.</p>
        <textarea className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm" placeholder="Nota / justificativa" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-gold" onClick={() => decide("manter")}>Manter</button>
        <button type="button" className="btn-ghost" onClick={() => decide("alterar")}>Alterar</button>
        <button type="button" className="btn-ghost" onClick={() => decide("aguardar")}>Aguardar</button>
        <button type="button" className="btn-ghost" onClick={() => setI(Math.min(items.length - 1, i + 1))}>Próximo</button>
      </div>
      {msg && <p className="mt-2 text-sm text-[var(--gold)]">{msg}</p>}
    </div>
  );
}
