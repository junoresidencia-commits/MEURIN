"use client";

import { useEffect, useState } from "react";

type Flag = { id: string; ok: boolean; label: string; detail: string; severity: string };
type Health = {
  mode: string;
  lastDeploy: string | null;
  lastIntegrityAt: string | null;
  unpaidClosings: number;
  clinics: { total: number; pilot: number; active: number };
  counts: Record<string, number>;
  flags: Flag[];
};

const TONE: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  medium: "border-amber-100 bg-amber-50/60 text-[var(--text)]",
  ok: "border-[var(--border)] bg-white text-[var(--text)]",
};

export default function SaudePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/plataforma/saude")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
        setHealth(d.health);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--gold)]">Super Admin</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Saúde do Meu Rim</h1>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Descubra problemas antes da clínica reclamar. Sem prontuário e sem senha.
      </p>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {health && (
        <>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Modo {health.mode}
            {health.lastDeploy ? ` · deploy ${health.lastDeploy.slice(0, 7)}` : ""}
            {health.lastIntegrityAt ? ` · integridade ${new Date(health.lastIntegrityAt).toLocaleString("pt-BR")}` : ""}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="panel">
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Pacientes</p>
              <p className="font-display text-2xl font-extrabold">{health.counts.patients ?? 0}</p>
            </div>
            <div className="panel">
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Clínicas / piloto</p>
              <p className="font-display text-2xl font-extrabold">{health.clinics.total} / {health.clinics.pilot}</p>
            </div>
            <div className="panel">
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Fechamentos em aberto</p>
              <p className="font-display text-2xl font-extrabold">{health.unpaidClosings}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {health.flags.map((f) => (
              <div key={f.id} className={`rounded-2xl border px-4 py-3 ${TONE[f.severity] || TONE.ok}`}>
                <p className="font-bold">{f.ok ? "●" : "○"} {f.label}</p>
                <p className="text-sm opacity-80">{f.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
