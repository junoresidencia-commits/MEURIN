"use client";

import { useCallback, useEffect, useState } from "react";

type Doc = {
  id: string;
  name: string;
  email: string;
  crm: string;
  specialty: string;
  clinic: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  roles: string[];
  isSelf?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando aceite",
  correction: "Correção solicitada",
  approved: "Ativo",
  rejected: "Recusado",
  suspended: "Suspenso",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  crm: "",
  specialty: "Nefrologia",
  phone: "",
  clinic: "",
};

export default function UsuariosPage() {
  const [doctors, setDoctors] = useState<Doc[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/plataforma/doctors");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Não foi possível carregar.");
    setDoctors(d.doctors || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id + status);
    setErr("");
    setMsg("");
    const r = await fetch("/api/plataforma/doctors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const d = await r.json();
    setBusy("");
    if (!r.ok) {
      setErr(d.error || "Não foi possível atualizar.");
      return;
    }
    setMsg(
      status === "approved"
        ? "Cadastro aceito. A pessoa já entra no Meu Rim."
        : status === "rejected"
          ? "Cadastro recusado."
          : "Cadastro atualizado."
    );
    await load();
  }

  async function addDoctor() {
    setSaving(true);
    setErr("");
    setMsg("");
    const r = await fetch("/api/plataforma/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setErr(d.error || "Não foi possível adicionar.");
      return;
    }
    setMsg("Médico adicionado e já aceito. Pode entrar com o e-mail e a senha.");
    setForm(EMPTY_FORM);
    setShowAdd(false);
    await load();
  }

  const pending = (doctors || []).filter((d) => d.status === "pending" || d.status === "correction");
  const others = (doctors || []).filter((d) => d.status !== "pending" && d.status !== "correction");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Usuários</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Adicione, aceite ou recuse médicos aqui, no seu login. Não precisa de outra conta.
          </p>
        </div>
        <button type="button" className="btn-gold" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Fechar" : "Adicionar médico"}
        </button>
      </div>
      {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
      {msg && <p className="mt-4 text-sm text-[var(--gold)]">{msg}</p>}

      {showAdd && (
        <div className="panel mt-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Adicionar médico (já aceito)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Nome completo"],
                ["email", "E-mail"],
                ["password", "Senha"],
                ["crm", "CRM"],
                ["specialty", "Especialidade"],
                ["phone", "Telefone"],
                ["clinic", "Clínica"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
                <input
                  type={k === "password" ? "password" : k === "email" ? "email" : "text"}
                  className="input-field"
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  autoComplete={k === "password" ? "new-password" : "off"}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn-gold"
            disabled={saving || !form.name || !form.email || !form.password || !form.crm}
            onClick={() => void addDoctor()}
          >
            {saving ? "Adicionando…" : "Adicionar e aceitar"}
          </button>
        </div>
      )}

      <h2 className="mt-6 font-display text-xl font-extrabold">Aguardando aceite</h2>
      {doctors && pending.length === 0 && (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum cadastro esperando.</p>
      )}
      <div className="mt-3 space-y-2">
        {pending.map((d) => (
          <DoctorCard key={d.id} d={d} busy={busy} onStatus={setStatus} />
        ))}
      </div>

      <h2 className="mt-8 font-display text-xl font-extrabold">Médicos</h2>
      {doctors && others.length === 0 && pending.length === 0 && (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum médico cadastrado.</p>
      )}
      <div className="mt-3 space-y-2">
        {others.map((d) => (
          <DoctorCard key={d.id} d={d} busy={busy} onStatus={setStatus} />
        ))}
      </div>
    </div>
  );
}

function DoctorCard({
  d,
  busy,
  onStatus,
}: {
  d: Doc;
  busy: string;
  onStatus: (id: string, status: string) => void;
}) {
  const waiting = d.status === "pending" || d.status === "correction";
  const canAccept = !d.isSelf && d.status !== "approved";
  const canReject = !d.isSelf && d.status !== "rejected";
  return (
    <div className="panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">{d.name}</p>
        <p className={`text-xs font-semibold ${waiting ? "text-[var(--warn)]" : "text-[var(--gold)]"}`}>
          {STATUS_LABEL[d.status] || d.status}
        </p>
      </div>
      <p className="text-sm text-[var(--text-soft)]">
        {d.email} · CRM {d.crm} · {d.specialty}
      </p>
      {d.clinic && <p className="text-sm text-[var(--text-muted)]">{d.clinic}</p>}
      {d.phone && <p className="text-sm text-[var(--text-muted)]">{d.phone}</p>}
      <p className="mt-1 text-xs font-semibold text-[var(--gold)]">{["MEDICO", ...d.roles].join(" + ")}</p>
      {d.isSelf ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">Esta é a sua conta.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canAccept && (
            <button type="button" className="btn-gold" disabled={Boolean(busy)} onClick={() => onStatus(d.id, "approved")}>
              {busy === d.id + "approved" ? "Aceitando…" : "Aceitar"}
            </button>
          )}
          {canReject && (
            <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => onStatus(d.id, "rejected")}>
              {busy === d.id + "rejected" ? "Recusando…" : "Recusar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
