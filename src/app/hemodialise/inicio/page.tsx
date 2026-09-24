"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHd } from "@/components/hd/HdShell";
import { HD_EXAM_LABEL, monthLabel } from "@/lib/hd-labels";

type Dash = {
  month: { year: number; month: number; status: string };
  cards: { examesRecebidos: number; paraRevisar: number; pendencias: number; criticos: number; revisados: number; total: number };
  missing: Record<string, number>;
};

export default function HdInicioPage() {
  const { year, month, shift, q, can } = useHd();
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const u = new URLSearchParams({ view: "dashboard", year: String(year), month: String(month), shift, q });
    fetch(`/api/hemodialise?${u}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setData(d);
      })
      .catch(() => setErr("Não foi possível carregar o painel."));
  }, [year, month, shift, q]);

  if (err) return <p className="text-[var(--danger)]">{err}</p>;
  if (!data) return <p className="text-[var(--text-muted)]">Carregando painel…</p>;

  const cards = [
    { k: "Exames recebidos", v: data.cards.examesRecebidos, c: "text-[var(--text)]" },
    { k: "Para revisar", v: data.cards.paraRevisar, c: "text-[var(--warn)]" },
    { k: "Pendências", v: data.cards.pendencias, c: "text-[var(--gold)]" },
    { k: "Críticos", v: data.cards.criticos, c: "text-[var(--danger)]" },
    { k: "Revisados", v: data.cards.revisados, c: "text-[var(--green)]" },
  ];

  const missing = Object.entries(data.missing)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">
        {monthLabel(data.month.year, data.month.month)} · {data.cards.total} pacientes no mapa
        {data.month.status === "closed" ? " · mês fechado" : ""}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.k} className="panel">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{c.k}</p>
            <p className={`font-display mt-2 text-4xl font-extrabold ${c.v && c.k === "Críticos" ? "text-[var(--danger)]" : c.c}`}>{c.v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {can("review") && (
          <Link href="/hemodialise/revisao" className="btn-gold">Resolver pendências</Link>
        )}
        {can("view_map") && (
          <Link href="/hemodialise/mapa" className="btn-ghost">Mapa da Hemodiálise</Link>
        )}
      </div>
      {missing.length > 0 && (
        <div className="panel mt-6">
          <p className="font-display text-lg font-bold">Exames faltantes</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missing.map(([code, n]) => (
              <p key={code} className="text-sm">
                <span className="font-semibold">{HD_EXAM_LABEL[code as keyof typeof HD_EXAM_LABEL] || code} pendente:</span> {n} paciente{n === 1 ? "" : "s"}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
