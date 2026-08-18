"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Nut = {
  id: string; name: string; cpf?: string | null; email?: string | null; phone?: string | null;
  crn?: string | null; uf?: string | null; specialty?: string | null; bio?: string | null;
  photoUrl?: string | null; documents?: { name: string; url: string }[]; status: string; createdAt: string;
  commissionPercent?: number | null; payoutStatus?: string; consultationPriceCents?: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando", active: "Aprovada", rejected: "Recusada", suspended: "Suspensa", inactive: "Inativa",
};

export default function AdminNutricionistasPage() {
  const router = useRouter();
  const [list, setList] = useState<Nut[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");

  async function load() {
    const res = await fetch("/api/admin/nutritionists");
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const d = await res.json();
    setList(d.nutritionists || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/nutritionists", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  }
  async function setFinance(id: string, patch: { commissionPercent?: number; payoutStatus?: string }) {
    await fetch("/api/admin/nutritionists", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    await load();
  }

  const filtered = list.filter((n) => tab === "all" ? true : tab === "pending" ? n.status === "pending" : n.status === "active");

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">← Administração</Link>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Nutricionistas</h1>
      <p className="mt-1 text-[var(--text-muted)]">Aprove, recuse ou suspenda os cadastros de nutricionistas (auto-registro).</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["pending", "active", "all"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
            {t === "pending" ? "Aguardando" : t === "active" ? "Aprovadas" : "Todas"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma nutricionista nesta lista.</p>}
        {filtered.map((n) => (
          <div key={n.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {n.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.photoUrl} alt={n.name} className="h-12 w-12 rounded-full border border-[var(--border)] object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">{n.name.slice(0, 2).toUpperCase()}</span>
                )}
                <div>
                  <p className="font-semibold text-[var(--text)]">{n.name} {n.crn && <span className="text-sm font-normal text-[var(--text-muted)]">· CRN {n.crn}{n.uf ? "-" + n.uf : ""}</span>}</p>
                  <p className="text-xs text-[var(--text-muted)]">{[n.cpf, n.email, n.phone].filter(Boolean).join(" · ") || "—"}</p>
                  {n.bio && <p className="mt-1 text-xs text-[var(--text-soft)]">{n.bio}</p>}
                  {n.documents && n.documents.length > 0 && (
                    <p className="mt-1 text-xs">{n.documents.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" download={d.name} className="mr-2 font-semibold text-[var(--gold)]">📎 {d.name}</a>)}</p>
                  )}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${n.status === "active" ? "bg-emerald-100 text-emerald-700" : n.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{STATUS_LABEL[n.status] || n.status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {n.status !== "active" && <button type="button" className="btn-gold text-sm" onClick={() => setStatus(n.id, "active")}>Aprovar</button>}
              {n.status !== "rejected" && <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "rejected")}>Recusar</button>}
              {n.status === "active" && <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "suspended")}>Suspender</button>}
            </div>
            {n.status === "active" && (
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Comissão da plataforma (%)</span>
                  <input type="number" min="0" max="100" defaultValue={n.commissionPercent ?? 0} className="input-field w-28" onBlur={(e) => setFinance(n.id, { commissionPercent: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Recebimento</span>
                  <select className="input-field w-40" defaultValue={n.payoutStatus || "active"} onChange={(e) => setFinance(n.id, { payoutStatus: e.target.value })}>
                    <option value="active">Liberado</option><option value="pending">Em análise</option><option value="blocked">Bloqueado</option>
                  </select>
                </label>
                {n.consultationPriceCents != null && <span className="text-xs text-[var(--text-muted)]">Consulta: R$ {(n.consultationPriceCents / 100).toFixed(2)}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
