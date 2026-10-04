"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Charge = {
  id: string;
  actorKind: string;
  professionalName: string;
  kind: string;
  amountCents: number;
  status: string;
  note?: string | null;
  createdAt: string;
};

type Pix = {
  key?: string;
  holderName?: string;
  adminEmail?: string;
  configured?: boolean;
};

const KIND_LABEL: Record<string, string> = {
  psychology: "Psicologia",
  nursing: "Enfermagem",
  nutrition: "Nutrição",
  doctor: "Médico",
};

const STATUS_LABEL: Record<string, string> = {
  due: "A receber",
  declared: "Profissional avisou pagamento",
  received: "Recebido",
};

export default function AdminRepassePage() {
  const router = useRouter();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [totals, setTotals] = useState({ dueCents: 0, receivedCents: 0, count: 0 });
  const [pix, setPix] = useState<Pix | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "received" | "all">("open");

  async function load() {
    const res = await fetch("/api/admin/platform-charges");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const d = await res.json();
    setCharges(d.charges || []);
    setTotals(d.totals || { dueCents: 0, receivedCents: 0, count: 0 });
    setPix(d.pix || null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/platform-charges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  const shown = charges.filter((c) => {
    if (filter === "all") return true;
    if (filter === "received") return c.status === "received";
    return c.status === "due" || c.status === "declared";
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--gold)]">
        ← Administração
      </Link>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Repasse da plataforma</h1>
      <p className="mt-1 text-[var(--text-muted)]">
        O que cada profissional deve à conta do admin. Você define grátis, % ou valor por pessoa ao aceitar o cadastro.
      </p>

      <div className="panel mt-5 text-sm">
        <p>
          <span className="text-[var(--text-muted)]">Pix da plataforma:</span>{" "}
          <strong>{pix?.key || "não configurado"}</strong>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Titular:</span> {pix?.holderName || "—"}
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Admin:</span> {pix?.adminEmail || "—"}
        </p>
        <p className="mt-2 text-xs text-[var(--text-soft)]">
          Sem chave em Dados da empresa, usamos o e-mail do admin. Ajuste em{" "}
          <Link href="/admin/empresa" className="font-semibold text-[var(--gold)]">
            Dados da empresa
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Em aberto</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">R$ {(totals.dueCents / 100).toFixed(2)}</p>
        </div>
        <div className="panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Já recebido</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">R$ {(totals.receivedCents / 100).toFixed(2)}</p>
        </div>
        <div className="panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Lançamentos</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--text)]">{totals.count}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["open", "received", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${filter === t ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}
          >
            {t === "open" ? "Em aberto" : t === "received" ? "Recebidos" : "Todos"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
        {!loading && shown.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum lançamento nesta lista.</p>}
        {shown.map((c) => (
          <div key={c.id} className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--text)]">
                {c.professionalName}{" "}
                <span className="text-sm font-normal text-[var(--text-muted)]">
                  · {KIND_LABEL[c.actorKind] || c.actorKind} · {c.kind === "entrada" ? "entrada" : "atendimento"}
                </span>
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {c.note || "—"} · {new Date(c.createdAt).toLocaleString("pt-BR")} · {STATUS_LABEL[c.status] || c.status}
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--text)]">R$ {(c.amountCents / 100).toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              {c.status !== "received" && (
                <button type="button" className="btn-gold text-sm" onClick={() => void setStatus(c.id, "received")}>
                  Marcar recebido
                </button>
              )}
              {c.status === "received" && (
                <button type="button" className="btn-ghost text-sm" onClick={() => void setStatus(c.id, "due")}>
                  Reabrir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
