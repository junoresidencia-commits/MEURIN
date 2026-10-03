"use client";

import { useEffect, useState } from "react";
import { toFriendlyMessage } from "@/lib/user-errors";

export function PatientMedicationsForm({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/patient/medications")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => {
        if (d?.medications) setText(d.medications);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/patient/medications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setMsg("Medicações salvas. Seu médico já vê no prontuário.");
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível salvar as medicações."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando medicações…</p>;
  }

  return (
    <form onSubmit={(e) => void save(e)} className={compact ? "space-y-3" : "panel space-y-3"}>
      {!compact && (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicações que você toma</p>
          <p className="text-sm text-[var(--text-soft)]">
            Uma por linha. Seu médico vê esta lista no prontuário e no resumo da consulta.
          </p>
        </>
      )}
      <textarea
        className="input-field min-h-[140px] text-sm"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMsg("");
          setErr("");
        }}
        placeholder={"Ex.:\nLosartana 50 mg de manhã\nAnlodipino 5 mg à noite\nSinvastatina 20 mg"}
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
      <button type="submit" className="btn-gold w-full" disabled={saving}>
        {saving ? "Salvando…" : "Salvar medicações"}
      </button>
    </form>
  );
}
