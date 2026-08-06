"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/scheduling-client";

type Doctor = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  crm: string;
  crmState?: string | null;
  rqe?: string | null;
  specialty: string;
  clinic?: string | null;
  consultationPriceCents: number;
  pixKey?: string | null;
  status: "pending" | "approved" | "rejected" | "suspended" | "correction";
  adminNote?: string | null;
  createdAt: string;
};

const TABS = [
  { id: "aguardando", label: "Aguardando aprovação", match: ["pending", "correction"] },
  { id: "aprovados", label: "Aprovados", match: ["approved"] },
  { id: "recusados", label: "Recusados", match: ["rejected"] },
  { id: "suspensos", label: "Suspensos", match: ["suspended"] },
] as const;

const STATUS_LABEL: Record<Doctor["status"], string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
  correction: "Correção solicitada",
};

export default function AdminPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("aguardando");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/doctors");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setDoctors(data.doctors || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string, adminNote?: string) {
    await fetch("/api/admin/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, adminNote }),
    });
    await load();
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
  }

  const current = TABS.find((t) => t.id === tab)!;
  const list = doctors.filter((d) => (current.match as readonly string[]).includes(d.status));
  const countFor = (t: (typeof TABS)[number]) =>
    doctors.filter((d) => (t.match as readonly string[]).includes(d.status)).length;

  if (loading) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--gold)]">Administração</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Médicos cadastrados</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Fechar" : "+ Criar médico"}
          </button>
          <a href="/admin/empresa" className="btn-ghost">Dados da empresa</a>
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      {showCreate && <CreateDoctor onCreated={load} />}

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"
            }`}
          >
            {t.label} ({countFor(t)})
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {list.length === 0 && <p className="text-[var(--text-muted)]">Nenhum médico nesta categoria.</p>}
        {list.map((d) => (
          <div key={d.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[var(--text)]">{d.name}</p>
                <p className="text-sm text-[var(--text-muted)]">{d.specialty} · {STATUS_LABEL[d.status]}</p>
              </div>
              <p className="text-sm font-bold text-[var(--gold)]">{formatBRL(d.consultationPriceCents)}</p>
            </div>
            <div className="mt-3 grid gap-1 text-sm text-[var(--text-soft)] sm:grid-cols-2">
              <p><span className="text-[var(--text-muted)]">E-mail:</span> {d.email}</p>
              <p><span className="text-[var(--text-muted)]">Telefone:</span> {d.phone || "—"}</p>
              <p><span className="text-[var(--text-muted)]">CRM:</span> {d.crm}{d.crmState ? ` / ${d.crmState}` : ""}</p>
              <p><span className="text-[var(--text-muted)]">RQE:</span> {d.rqe || "—"}</p>
              <p><span className="text-[var(--text-muted)]">Clínica:</span> {d.clinic || "—"}</p>
              <p><span className="text-[var(--text-muted)]">Solicitado em:</span> {new Date(d.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
            {d.adminNote && (
              <p className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
                Aviso ao médico: {d.adminNote}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {(d.status === "pending" || d.status === "correction" || d.status === "rejected") && (
                <button type="button" className="btn-gold" onClick={() => setStatus(d.id, "approved")}>Aprovar médico</button>
              )}
              {(d.status === "pending" || d.status === "correction") && (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const note = window.prompt("O que precisa ser corrigido?") || "";
                      setStatus(d.id, "correction", note);
                    }}
                  >
                    Solicitar correção
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setStatus(d.id, "rejected")}>Recusar cadastro</button>
                </>
              )}
              {d.status === "approved" && (
                <button type="button" className="btn-ghost" onClick={() => setStatus(d.id, "suspended")}>Suspender acesso</button>
              )}
              {d.status === "suspended" && (
                <button type="button" className="btn-gold" onClick={() => setStatus(d.id, "approved")}>Reativar acesso</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateDoctor({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", crm: "", crmState: "", specialty: "Nefrologia", clinic: "", pixKey: "", consultationPriceCents: "350" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setSaving(true); setErr(""); setMsg("");
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consultationPriceCents: Math.round(Number(form.consultationPriceCents) * 100) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao criar.");
      setMsg("Médico criado e aprovado.");
      setForm({ name: "", email: "", password: "", phone: "", crm: "", crmState: "", specialty: "Nefrologia", clinic: "", pixKey: "", consultationPriceCents: "350" });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    ["name", "Nome completo"],
    ["email", "E-mail"],
    ["password", "Senha"],
    ["phone", "Telefone"],
    ["crm", "CRM"],
    ["crmState", "UF do CRM"],
    ["specialty", "Especialidade"],
    ["clinic", "Clínica"],
    ["pixKey", "Chave Pix"],
  ] as const;

  return (
    <div className="panel mt-5 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Criar médico (já aprovado)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
            <input
              type={k === "password" ? "password" : "text"}
              className="input-field"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor (R$)</span>
          <input type="number" className="input-field" value={form.consultationPriceCents} onChange={(e) => set("consultationPriceCents", e.target.value)} />
        </label>
      </div>
      {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
      <button type="button" className="btn-gold" onClick={submit} disabled={saving || !form.name || !form.email || !form.password || !form.crm}>
        {saving ? "Criando…" : "Criar médico"}
      </button>
    </div>
  );
}
