"use client";

import { useEffect, useState } from "react";
import {
  CLINICAL_FIELDS,
  CLINICAL_GROUPS,
  ESTAGIOS_G,
  CATEGORIAS_A,
  ETIOLOGIAS,
  TRI_OPTIONS,
  computeImc,
  type ClinicalProfileData,
} from "@/lib/clinical-fields";

type FieldMeta = { source: string; at: string };
type HistoryEntry = { field: string; from: unknown; to: unknown; source: string; at: string };

export function ClinicalProfileEditor({ emailParam }: { emailParam: string }) {
  const [data, setData] = useState<ClinicalProfileData>({});
  const [meta, setMeta] = useState<Record<string, FieldMeta>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    return fetch(`/api/doctor/patients/${emailParam}/profile`)
      .then((r) => (r.ok ? r.json() : { profile: {}, meta: {}, history: [] }))
      .then((d) => {
        setData(d.profile || {});
        setMeta(d.meta || {});
        setHistory(Array.isArray(d.history) ? d.history : []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailParam]);

  function set(key: string, value: unknown) {
    setMsg("");
    setData((d) => ({ ...d, [key]: value }));
  }
  function toggleMulti(key: string, value: string) {
    setData((d) => {
      const arr = Array.isArray(d[key]) ? (d[key] as string[]) : [];
      return { ...d, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/doctor/patients/${emailParam}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error();
      await load();
      setMsg("Perfil clínico salvo.");
    } catch {
      setMsg("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-[var(--text-muted)]">Carregando perfil…</p>;

  const imc = computeImc(data);
  const srcOf = (key: string) => {
    const s = meta[key]?.source;
    return s ? <span className="ml-1 rounded-full bg-[var(--gold-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--gold)]">{s}</span> : null;
  };

  return (
    <div className="space-y-4">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Perfil clínico estruturado</p>
        <p className="text-sm text-[var(--text-soft)]">
          Preencha o que souber — o que ficar em branco é tratado como <b>Desconhecido</b> (não como
          &quot;Não&quot;). Estes dados alimentam o módulo de Pesquisa sem mudar o prontuário nem os gráficos.
        </p>
      </div>

      {CLINICAL_GROUPS.map((group) => (
        <div key={group} className="panel space-y-3">
          <p className="text-sm font-bold text-[var(--text)]">{group}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CLINICAL_FIELDS.filter((f) => f.group === group).map((f) => {
              if (f.kind === "number") {
                return (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}{f.unit ? ` (${f.unit})` : ""}{srcOf(f.key)}</span>
                    <input inputMode="decimal" className="input-field" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} />
                  </label>
                );
              }
              if (f.kind === "enumG" || f.kind === "enumA" || f.kind === "etiologia") {
                const opts = f.kind === "enumG" ? ESTAGIOS_G.map((v) => ({ value: v, label: v })) : f.kind === "enumA" ? CATEGORIAS_A.map((v) => ({ value: v, label: v })) : ETIOLOGIAS;
                return (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}{srcOf(f.key)}</span>
                    <select className="input-field" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">Desconhecido</option>
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (f.kind === "text") {
                const isResumo = f.key === "resumo";
                return (
                  <div key={f.key} className={isResumo ? "sm:col-span-2" : "block"}>
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}{srcOf(f.key)}</span>
                    {isResumo ? (
                      <textarea className="input-field min-h-[70px]" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder="Resumo da situação clínica (texto livre)." />
                    ) : (
                      <input className="input-field" value={String(data[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} placeholder="Especifique…" />
                    )}
                  </div>
                );
              }
              if (f.kind === "etiologiaMulti") {
                const arr = Array.isArray(data[f.key]) ? (data[f.key] as string[]) : [];
                return (
                  <div key={f.key} className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}{srcOf(f.key)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ETIOLOGIAS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleMulti(f.key, o.value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${arr.includes(o.value) ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              // tri
              const cur = data[f.key] as string | undefined;
              return (
                <div key={f.key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{f.label}{srcOf(f.key)}</span>
                  <div className="flex gap-1">
                    {TRI_OPTIONS.map((o) => {
                      const selected = (cur ?? "desconhecido") === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set(f.key, o.value)}
                          className={`flex-1 rounded-xl px-2 py-1.5 text-xs font-bold transition ${selected ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {group === "Dados gerais" && imc != null && (
            <p className="text-sm text-[var(--text-soft)]">IMC calculado: <b className="text-[var(--text)]">{String(imc).replace(".", ",")} kg/m²</b></p>
          )}
        </div>
      ))}

      {history.length > 0 && (
        <div className="panel space-y-2">
          <button type="button" className="text-sm font-bold text-[var(--gold)]" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "▾" : "▸"} Histórico de alterações ({history.length})
          </button>
          {showHistory && (
            <ul className="space-y-1 text-xs text-[var(--text-soft)]">
              {[...history].reverse().map((h, i) => {
                const f = CLINICAL_FIELDS.find((x) => x.key === h.field);
                return (
                  <li key={i} className="border-b border-[var(--border)] pb-1">
                    <b className="text-[var(--text)]">{f?.label || h.field}</b>: {String(h.from ?? "—")} → {String(h.to ?? "—")}
                    <span className="text-[var(--text-muted)]"> · fonte: {h.source} · {new Date(h.at).toLocaleString("pt-BR")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
      <button type="button" className="btn-gold" onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Salvar perfil clínico"}
      </button>
    </div>
  );
}
