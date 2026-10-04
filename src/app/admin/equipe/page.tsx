"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFeeFields } from "@/components/AdminFeeFields";
import type { AppFeeMode } from "@/lib/platform-fees";

type Pro = {
  id: string;
  role: string;
  name: string;
  cpf?: string | null;
  email?: string | null;
  registry?: string | null;
  uf?: string | null;
  city?: string | null;
  photoUrl?: string | null;
  status: string;
  createdAt: string;
  consultationPriceCents?: number | null;
  returnPriceCents?: number | null;
  commissionPercent?: number | null;
  entryFeeCents?: number | null;
  appFeeMode?: AppFeeMode;
  payoutStatus?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  active: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
  inactive: "Inativo",
};

type Draft = { mode: AppFeeMode; percent: string; fixed: string };

export default function AdminAlliedPage() {
  const router = useRouter();
  const [list, setList] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/allied");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await res.json();
    setList(d.professionals || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  function draftOf(n: Pro): Draft {
    return (
      drafts[n.id] || {
        mode: n.appFeeMode || "gratis",
        percent: String(n.commissionPercent ?? 0),
        fixed: n.entryFeeCents ? String(n.entryFeeCents / 100) : "",
      }
    );
  }

  function setDraft(id: string, patch: Partial<Draft>, base: Draft) {
    setDrafts((prev) => ({ ...prev, [id]: { ...base, ...patch } }));
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/allied", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function saveFee(n: Pro) {
    const d = draftOf(n);
    setMsg("");
    await fetch("/api/admin/allied", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: n.id,
        appFeeMode: d.mode,
        commissionPercent: Number(d.percent || 0),
        entryFee: Number(String(d.fixed).replace(",", ".") || 0),
      }),
    });
    setMsg(`Cobrança de ${n.name} salva.`);
    await load();
  }

  const filtered = list.filter((n) => (tab === "all" ? true : tab === "pending" ? n.status === "pending" : n.status === "active"));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">
        ← Administração
      </Link>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Psicologia e Enfermagem</h1>
      <p className="mt-1 text-[var(--text-muted)]">
        Ao aceitar, defina pessoa a pessoa: app grátis, % de cada atendimento ou valor por entrada. O valor entra no Pix da
        plataforma (conta do admin).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["pending", "active", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}
          >
            {t === "pending" ? "Aguardando" : t === "active" ? "Ativos" : "Todos"}
          </button>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--green)]">{msg}</p>}
      <div className="mt-4 grid gap-3">
        {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum profissional nesta lista.</p>}
        {filtered.map((n) => {
          const d = draftOf(n);
          return (
            <div key={n.id} className="panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {n.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.photoUrl} alt="" className="h-12 w-12 rounded-full border border-[var(--border)] object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">{n.name.slice(0, 2).toUpperCase()}</span>
                  )}
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {n.name}{" "}
                    <span className="text-sm font-normal text-[var(--text-muted)]">
                      · {n.role === "nursing" ? "Enfermagem" : "Psicologia"} {n.registry ? `· ${n.registry}` : ""}{n.city ? ` · ${n.city}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{[n.cpf, n.email].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    Consulta: {n.consultationPriceCents != null ? `R$ ${(n.consultationPriceCents / 100).toFixed(2)}` : "não definida"}
                    {" · "}
                    Retorno: {n.returnPriceCents != null ? `R$ ${(n.returnPriceCents / 100).toFixed(2)}` : "grátis / não definido"}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{STATUS_LABEL[n.status] || n.status}</span>
                </div>
                </div>
                <div className="flex gap-2">
                  {n.status !== "active" && (
                    <button type="button" className="btn-gold text-sm" onClick={() => setStatus(n.id, "active")}>
                      Aprovar
                    </button>
                  )}
                  {n.status === "pending" && (
                    <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "rejected")}>
                      Recusar
                    </button>
                  )}
                  {n.status === "active" && (
                    <button type="button" className="btn-ghost text-sm" onClick={() => setStatus(n.id, "suspended")}>
                      Suspender
                    </button>
                  )}
                </div>
              </div>
              <AdminFeeFields
                mode={d.mode}
                percent={d.percent}
                fixedReais={d.fixed}
                onMode={(v) => setDraft(n.id, { mode: v }, d)}
                onPercent={(v) => setDraft(n.id, { percent: v }, d)}
                onFixed={(v) => setDraft(n.id, { fixed: v }, d)}
                onSave={() => void saveFee(n)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
