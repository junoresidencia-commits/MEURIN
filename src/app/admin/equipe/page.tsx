"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE_META, isAlliedRole } from "@/lib/allied-types";

type Pro = {
  id: string; role: string; name: string; cpf?: string | null; email?: string | null;
  registry?: string | null; uf?: string | null; status: string; createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando", active: "Aprovado", rejected: "Recusado", suspended: "Suspenso", inactive: "Inativo",
};

export default function AdminAlliedPage() {
  const router = useRouter();
  const [list, setList] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");

  async function load() {
    const res = await fetch("/api/admin/allied");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setList(d.professionals || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/allied", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  }

  const filtered = list.filter((n) => tab === "all" ? true : tab === "pending" ? n.status === "pending" : n.status === "active");

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">← Administração</Link>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Equipe assistencial</h1>
      <p className="mt-1 text-[var(--text-muted)]">Psicologia, enfermagem, cardiologia e endocrinologia. Aprove cadastros. O médico também libera o acesso ao adicionar o profissional à equipe.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["pending", "active", "all"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
            {t === "pending" ? "Aguardando" : t === "active" ? "Ativos" : "Todos"}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum profissional nesta lista.</p>}
        {filtered.map((n) => (
          <div key={n.id} className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--text)]">{n.name} <span className="text-sm font-normal text-[var(--text-muted)]">· {isAlliedRole(n.role) ? ROLE_META[n.role].label : n.role} {n.registry ? `· ${n.registry}` : ""}</span></p>
              <p className="text-xs text-[var(--text-muted)]">{[n.cpf, n.email].filter(Boolean).join(" · ")}</p>
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{STATUS_LABEL[n.status] || n.status}</span>
            </div>
            <div className="flex gap-2">
              {n.status !== "active" && <button type="button" className="btn-gold text-sm" onClick={() => setStatus(n.id, "active")}>Aprovar</button>}
              {n.status === "pending" && <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "rejected")}>Recusar</button>}
              {n.status === "active" && <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "suspended")}>Suspender</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
