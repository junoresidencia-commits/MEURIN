"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/scheduling-client";
import type { PlanEnrollment } from "@/lib/plans";

const STATUSES = ["", "ativo", "aguardando_pagamento", "aguardando_confirmacao", "suspenso", "expirado", "cancelado", "concluido"];
const METHODS = ["", "pix", "card", "pix_direto"];

export default function AdminPlanosPage() {
  const router = useRouter();
  const [rows, setRows] = useState<(PlanEnrollment & { doctorName?: string })[]>([]);
  const [totals, setTotals] = useState({ count: 0, active: 0, grossCents: 0, doctorCents: 0, platformCents: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [patient, setPatient] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (method) params.set("method", method);
    if (patient) params.set("patient", patient);
    const res = await fetch(`/api/admin/plans?${params.toString()}`);
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await res.json();
    setRows(d.enrollments || []);
    setTotals(d.totals || { count: 0, active: 0, grossCents: 0, doctorCents: 0, platformCents: 0 });
    setLoading(false);
  }, [router, status, method, patient]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-[var(--gold)]">← Painel</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Planos de acompanhamento</h1>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Contratações" value={String(totals.count)} />
        <Metric label="Ativos" value={String(totals.active)} />
        <Metric label="Bruto (pagos)" value={formatBRL(totals.grossCents)} />
        <Metric label="Repasse médicos" value={formatBRL(totals.doctorCents)} />
        <Metric label="Plataforma" value={formatBRL(totals.platformCents)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "Todos os status"}</option>)}
        </select>
        <select className="input-field w-auto" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{m ? (m === "pix_direto" ? "Pix direto" : m) : "Todas as formas"}</option>)}
        </select>
        <input className="input-field w-auto" placeholder="Buscar paciente" value={patient} onChange={(e) => setPatient(e.target.value)} />
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-muted)]">Carregando…</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)]">
                <th className="py-2 pr-3">Médico</th>
                <th className="py-2 pr-3">Paciente</th>
                <th className="py-2 pr-3">Plano</th>
                <th className="py-2 pr-3">Original</th>
                <th className="py-2 pr-3">Desc.</th>
                <th className="py-2 pr-3">Final</th>
                <th className="py-2 pr-3">%méd</th>
                <th className="py-2 pr-3">Médico</th>
                <th className="py-2 pr-3">Plataf.</th>
                <th className="py-2 pr-3">Forma</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={11} className="py-4 text-[var(--text-muted)]">Nenhuma contratação.</td></tr>
              )}
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{e.doctorName}</td>
                  <td className="py-2 pr-3">{e.patientName}</td>
                  <td className="py-2 pr-3">{e.planName}</td>
                  <td className="py-2 pr-3">{formatBRL(e.pricing.originalPriceCents)}</td>
                  <td className="py-2 pr-3">{e.pricing.discountAmountCents ? `- ${formatBRL(e.pricing.discountAmountCents)}` : "—"}</td>
                  <td className="py-2 pr-3 font-semibold">{formatBRL(e.pricing.finalPriceCents)}</td>
                  <td className="py-2 pr-3">{e.pricing.doctorPercent}%</td>
                  <td className="py-2 pr-3">{formatBRL(e.pricing.doctorAmountCents)}</td>
                  <td className="py-2 pr-3">{formatBRL(e.pricing.platformAmountCents)}</td>
                  <td className="py-2 pr-3">{e.paymentMethod === "pix_direto" ? "Pix direto" : e.paymentMethod === "card" ? "Cartão" : "Pix"}</td>
                  <td className="py-2 pr-3">{e.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
