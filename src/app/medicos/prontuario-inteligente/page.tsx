"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Row = {
  patientKey: string;
  name: string;
  extracted: number;
  applied: number;
  pending: number;
  conflicts: number;
  status: "ok" | "review";
};

export default function ProntuarioInteligenteAuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/doctor/intelligence/backfill")
      .then((r) => {
        if (r.status === 401) { router.replace("/medicos/login"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setRows(d.rows || []); })
      .catch(() => setRows([]));
  }, [router]);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/doctor/intelligence/backfill", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Falha no reprocessamento.");
      setRows(d.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/mais" className="text-sm font-semibold text-[var(--gold)]">← Mais</Link>
          <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Revisão do prontuário inteligente</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Lê evoluções, exames e cadastro de todos os seus pacientes e atualiza o perfil — sem duplicar e sem sobrescrever o que você confirmou na mão.
          </p>
          <button type="button" className="btn-gold mt-4" onClick={run} disabled={busy}>
            {busy ? "Reprocessando…" : "Reprocessar todos os pacientes"}
          </button>
          {err && <p className="mt-3 text-sm text-[var(--danger)]">{err}</p>}

          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Paciente</th>
                  <th className="px-4 py-3 font-semibold">Encontradas</th>
                  <th className="px-4 py-3 font-semibold">Pendências</th>
                  <th className="px-4 py-3 font-semibold">Conflitos</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {(rows || []).map((r) => (
                  <tr key={r.patientKey} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-semibold text-[var(--text)]">{r.name}</td>
                    <td className="px-4 py-3">{r.extracted}</td>
                    <td className="px-4 py-3">{r.pending}</td>
                    <td className="px-4 py-3">{r.conflicts}</td>
                    <td className="px-4 py-3">
                      {r.status === "ok" ? "✅ Revisado" : "🟡 Revisar"}
                    </td>
                  </tr>
                ))}
                {rows && rows.length === 0 && (
                  <tr><td className="px-4 py-6 text-[var(--text-muted)]" colSpan={5}>Nenhuma execução ainda. Clique em reprocessar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <DoctorMobileNav />
      </div>
    </div>
  );
}
