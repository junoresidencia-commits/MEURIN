"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminFeeFields } from "@/components/AdminFeeFields";
import type { AppFeeMode } from "@/lib/platform-fees";

type Nut = {
  id: string;
  name: string;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  crn?: string | null;
  uf?: string | null;
  specialty?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  documents?: { name: string; url: string }[];
  status: string;
  createdAt: string;
  commissionPercent?: number | null;
  payoutStatus?: string;
  consultationPriceCents?: number | null;
  returnPriceCents?: number | null;
  entryFeeCents?: number | null;
  appFeeMode?: AppFeeMode;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  active: "Aprovada",
  rejected: "Recusada",
  suspended: "Suspensa",
  inactive: "Inativa",
};

type Draft = { mode: AppFeeMode; percent: string; fixed: string };

export default function AdminNutricionistasPage() {
  const router = useRouter();
  const [list, setList] = useState<Nut[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "active" | "all">("pending");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/admin/nutritionists");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await res.json();
    setList(d.nutritionists || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  function draftOf(n: Nut): Draft {
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
    await fetch("/api/admin/nutritionists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }
  async function setFinance(id: string, patch: Record<string, unknown>) {
    await fetch("/api/admin/nutritionists", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    await load();
  }
  async function saveFee(n: Nut) {
    const d = draftOf(n);
    setMsg("");
    await setFinance(n.id, {
      appFeeMode: d.mode,
      commissionPercent: Number(d.percent || 0),
      entryFee: Number(String(d.fixed).replace(",", ".") || 0),
    });
    setMsg(`Cobrança de ${n.name} salva.`);
  }

  const filtered = list.filter((n) => (tab === "all" ? true : tab === "pending" ? n.status === "pending" : n.status === "active"));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">
        ← Administração
      </Link>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Nutricionistas</h1>
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
            {t === "pending" ? "Aguardando" : t === "active" ? "Aprovadas" : "Todas"}
          </button>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-[var(--green)]">{msg}</p>}

      <div className="mt-4 grid gap-3">
        {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma nutricionista nesta lista.</p>}
        {filtered.map((n) => {
          const d = draftOf(n);
          return (
            <div key={n.id} className="panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {n.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.photoUrl} alt={n.name} className="h-12 w-12 rounded-full border border-[var(--border)] object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">
                      {n.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-[var(--text)]">
                      {n.name}{" "}
                      {n.crn && (
                        <span className="text-sm font-normal text-[var(--text-muted)]">
                          · CRN {n.crn}
                          {n.uf ? "-" + n.uf : ""}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{[n.cpf, n.email, n.phone].filter(Boolean).join(" · ") || "—"}</p>
                    {n.bio && <p className="mt-1 text-xs text-[var(--text-soft)]">{n.bio}</p>}
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      Consulta: {n.consultationPriceCents != null ? `R$ ${(n.consultationPriceCents / 100).toFixed(2)}` : "não definida"}
                      {" · "}
                      Retorno: {n.returnPriceCents != null ? `R$ ${(n.returnPriceCents / 100).toFixed(2)}` : "grátis / não definido"}
                    </p>
                    {n.documents && n.documents.length > 0 && (
                      <p className="mt-1 text-xs">
                        {n.documents.map((doc, i) => (
                          <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name} className="mr-2 font-semibold text-[var(--gold)]">
                            📎 {doc.name}
                          </a>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${n.status === "active" ? "bg-emerald-100 text-emerald-700" : n.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {STATUS_LABEL[n.status] || n.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.status !== "active" && (
                  <button type="button" className="btn-gold text-sm" onClick={() => setStatus(n.id, "active")}>
                    Aprovar
                  </button>
                )}
                {n.status !== "rejected" && (
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
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Recebimento</span>
                  <select
                    className="input-field w-40"
                    defaultValue={n.payoutStatus || "active"}
                    onChange={(e) => void setFinance(n.id, { payoutStatus: e.target.value })}
                  >
                    <option value="active">Liberado</option>
                    <option value="pending">Em análise</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </label>
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
