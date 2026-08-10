"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Perms = Record<string, boolean>;
type Member = {
  attendantId: string; name: string; cpf?: string | null; email?: string | null;
  phone?: string | null; whatsapp?: string | null; active: boolean; permissions: Perms; lastAccessAt?: string | null;
};

const PERM_LABELS: { key: string; label: string }[] = [
  { key: "agenda", label: "Ver agenda" },
  { key: "verHorarios", label: "Ver horários disponíveis" },
  { key: "criarPaciente", label: "Criar paciente" },
  { key: "editarCadastro", label: "Editar cadastro administrativo" },
  { key: "agendar", label: "Agendar consulta" },
  { key: "remarcar", label: "Remarcar consulta" },
  { key: "cancelar", label: "Cancelar consulta" },
  { key: "confirmar", label: "Confirmar consulta" },
  { key: "ausencia", label: "Registrar ausência" },
  { key: "whatsapp", label: "Abrir WhatsApp / contato" },
];

export default function MinhaEquipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Member[]>([]);
  const [form, setForm] = useState({ name: "", cpf: "", email: "", phone: "", whatsapp: "" });
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState<{ password: string } | null>(null);

  const load = useCallback(async () => {
    const auth = await fetch("/api/auth").then((r) => r.json());
    if (!auth.doctor) { router.replace("/medicos/login"); return; }
    const r = await fetch("/api/doctor/team").then((x) => x.json());
    setTeam(r.team || []);
    setLoading(false);
  }, [router]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setCreated(null);
    if (!form.name.trim() || (!form.cpf.trim() && !form.email.trim())) { setMsg("Informe o nome e CPF e/ou e-mail."); return; }
    const res = await fetch("/api/doctor/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error || "Falha ao adicionar."); return; }
    if (d.created && d.defaultPassword) setCreated({ password: d.defaultPassword });
    setMsg(d.linked ? "Atendente já existia — vinculada à sua equipe." : "Atendente adicionada.");
    setForm({ name: "", cpf: "", email: "", phone: "", whatsapp: "" });
    load();
  }
  async function savePerms(m: Member, permissions: Perms) {
    setTeam((xs) => xs.map((x) => (x.attendantId === m.attendantId ? { ...x, permissions } : x)));
    await fetch("/api/doctor/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendantId: m.attendantId, permissions }) });
  }
  async function toggleActive(m: Member) {
    await fetch("/api/doctor/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendantId: m.attendantId, active: !m.active }) });
    load();
  }
  async function remove(m: Member) {
    if (!window.confirm(`Remover ${m.name} da sua equipe? (o histórico é mantido)`)) return;
    await fetch("/api/doctor/team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendantId: m.attendantId }) });
    load();
  }

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/configuracoes" className="text-sm font-semibold text-[var(--gold)]">← Configurações</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Minha equipe — Atendentes</h1>
          <p className="mt-1 text-[var(--text-muted)]">Cadastre suas atendentes (por CPF e/ou e-mail). Elas entram com login próprio e só fazem tarefas administrativas — nunca acessam o conteúdo clínico.</p>

          <form onSubmit={add} className="panel mt-6 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo</span><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF</span><input className="input-field" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} inputMode="numeric" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail (opcional)</span><input className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">WhatsApp (opcional)</span><input className="input-field" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} inputMode="tel" /></label>
            <div className="sm:col-span-2"><button type="submit" className="btn-gold">+ Adicionar atendente</button></div>
          </form>
          {msg && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
          {created && (
            <div className="mt-2 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-sm text-[var(--text)]">
              Senha inicial da atendente: <strong>{created.password}</strong>. Ela entra em <Link href="/atendente/login" className="underline">/atendente/login</Link> com o CPF ou e-mail e essa senha (peça para trocar depois).
            </div>
          )}

          <div className="mt-6 grid gap-3">
            {team.length === 0 && <p className="panel text-[var(--text-muted)]">Nenhuma atendente ainda.</p>}
            {team.map((m) => (
              <div key={m.attendantId} className="panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{m.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.active ? "Ativa" : "Inativa"}</span></p>
                    <p className="text-xs text-[var(--text-muted)]">{[m.cpf ? `CPF ${m.cpf}` : "", m.email].filter(Boolean).join(" · ")}{m.lastAccessAt ? ` · último acesso ${new Date(m.lastAccessAt).toLocaleDateString("pt-BR")}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-ghost text-sm" onClick={() => toggleActive(m)}>{m.active ? "Desativar" : "Ativar"}</button>
                    <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => remove(m)}>Remover</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {PERM_LABELS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <input type="checkbox" checked={Boolean(m.permissions[p.key])} onChange={(e) => savePerms(m, { ...m.permissions, [p.key]: e.target.checked })} className="accent-[var(--gold)]" />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
