"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Item = {
  id: string;
  patientName: string;
  cid10: string | null;
  diagnosis: string | null;
  medsCount: number;
  signedAt: string | null;
  createdAt: string;
};

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function DoctorLmePage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"assinar" | "todas">("assinar");

  function load() {
    setError("");
    fetch("/api/doctor/lme")
      .then((r) => { if (r.status === 401) { router.replace("/medicos/login"); return null; } return r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar as LME.")); })
      .then((d) => { if (d) setItems(d.items); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleSigned(it: Item) {
    const res = await fetch(`/api/lme/${it.id}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signed: !it.signedAt }) });
    if (res.ok) load();
    else window.alert("Não foi possível atualizar a assinatura.");
  }

  async function removeLme(it: Item) {
    if (!window.confirm(`Excluir esta LME de ${it.patientName}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/doctor/lme", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id }) });
    if (res.ok) setItems((prev) => (prev || []).filter((x) => x.id !== it.id));
    else window.alert("Não foi possível excluir a LME.");
  }

  const visible = (items || []).filter((i) => (filter === "assinar" ? !i.signedAt : true));

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">LME / CEAF</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Laudos criados por você. Marque como assinada depois de assinar (à mão no papel impresso ou digitalmente).</p>

          <div className="mt-4 flex gap-2">
            {(["assinar", "todas"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${filter === f ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
                {f === "assinar" ? "Para assinar" : "Todas"}{items ? <span className={`ml-1 ${filter === f ? "text-white/80" : "text-[var(--text-muted)]"}`}>{f === "assinar" ? items.filter((i) => !i.signedAt).length : items.length}</span> : null}
              </button>
            ))}
          </div>

          {error && <div className="mt-6 rounded-xl border border-[var(--danger)]/30 bg-[#fdecea] p-4 text-sm text-[var(--danger)]">{error} <button type="button" className="ml-2 font-semibold underline" onClick={load}>Tentar novamente</button></div>}
          {!items && !error && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--gold-soft)]/60" />)}</div>}
          {items && visible.length === 0 && !error && <p className="mt-8 text-sm text-[var(--text-muted)]">{filter === "assinar" ? "✓ Nenhuma LME pendente de assinatura." : "Nenhuma LME criada ainda."}</p>}

          {items && visible.length > 0 && (
            <ul className="mt-4 space-y-3">
              {visible.map((it) => (
                <li key={it.id} className="panel !p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg text-[var(--text)]">{it.patientName}</p>
                      <p className="text-sm text-[var(--text-muted)]">{[it.cid10, it.diagnosis].filter(Boolean).join(" · ") || "Sem CID/diagnóstico"} · {it.medsCount} medicação(ões)</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Criada em {fmt(it.createdAt)}{it.signedAt ? ` · assinada em ${fmt(it.signedAt)}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="whitespace-nowrap text-xs font-semibold" style={{ color: it.signedAt ? "var(--green)" : "#e08a2e" }}>{it.signedAt ? "🟢 Assinada" : "🟠 Para assinar"}</span>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/lme/${it.id}`} className="btn-ghost text-sm">Abrir LME</Link>
                        <button type="button" className="btn-gold text-sm" onClick={() => toggleSigned(it)}>{it.signedAt ? "Desmarcar" : "Marcar como assinada"}</button>
                        <button type="button" className="btn-ghost text-sm text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => removeLme(it)}>Excluir</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
