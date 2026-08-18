"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Perms = { verExames: boolean; verDiario: boolean; criarPlano: boolean; comentarDiario: boolean };
type Member = { nutritionistId: string; name: string; cpf?: string | null; email?: string | null; phone?: string | null; crn?: string | null; uf?: string | null; active: boolean; status?: string; permissions?: Perms; lastAccessAt?: string | null };

const PERM_LABELS: { key: keyof Perms; label: string }[] = [
  { key: "verExames", label: "Ver exames" },
  { key: "criarPlano", label: "Criar/liberar dieta" },
  { key: "verDiario", label: "Ver diário alimentar" },
  { key: "comentarDiario", label: "Comentar no diário" },
];

export default function EquipeNutricaoPage() {
  const router = useRouter();
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", cpf: "", email: "", phone: "", crn: "", uf: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [newPass, setNewPass] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const auth = await fetch("/api/auth").then((r) => r.json());
    if (!auth.doctor) { router.replace("/medicos/login"); return; }
    const d = await fetch("/api/doctor/nutrition-team").then((r) => r.json());
    setTeam(d.team || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!form.name || (!form.cpf && !form.email)) { setMsg("Informe nome e CPF e/ou e-mail."); return; }
    setSaving(true); setMsg(null); setNewPass(null);
    try {
      const res = await fetch("/api/doctor/nutrition-team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      if (d.created && d.defaultPassword) { setNewPass(d.defaultPassword); setMsg("Nutricionista criada e vinculada."); }
      else setMsg(d.message || "Nutricionista vinculada à sua equipe.");
      setForm({ name: "", cpf: "", email: "", phone: "", crn: "", uf: "" });
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }
  async function toggle(m: Member) {
    await fetch("/api/doctor/nutrition-team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nutritionistId: m.nutritionistId, active: !m.active }) });
    await load();
  }
  async function setPerm(m: Member, key: keyof Perms, value: boolean) {
    await fetch("/api/doctor/nutrition-team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nutritionistId: m.nutritionistId, permissions: { [key]: value } }) });
    await load();
  }
  async function remove(m: Member) {
    if (!window.confirm(`Remover ${m.name} da sua equipe de nutrição?`)) return;
    await fetch("/api/doctor/nutrition-team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nutritionistId: m.nutritionistId }) });
    await load();
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/mais" className="text-sm font-semibold text-[var(--gold)]">← Mais</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Equipe de Nutrição</h1>
          <p className="mt-1 text-[var(--text-muted)]">Adicione nutricionistas à sua equipe. Elas acessam apenas os seus pacientes, com dados renais e exames, para consulta e plano alimentar — sem alterar diagnóstico, receita, LME ou evolução médica.</p>

          <section className="panel mt-6 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo</span><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF</span><input className="input-field" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} inputMode="numeric" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span><input className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CRN</span><input className="input-field" value={form.crn} onChange={(e) => setForm({ ...form, crn: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF</span><input className="input-field" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} placeholder="BA" /></label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="button" className="btn-gold" onClick={add} disabled={saving}>{saving ? "Salvando…" : "Adicionar à equipe"}</button>
              {msg && <span className="text-sm font-semibold text-[var(--text-soft)]">{msg}</span>}
            </div>
            {newPass && <p className="sm:col-span-2 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text)]">Senha inicial para o primeiro acesso: <b>{newPass}</b> (a nutricionista entra em <b>/nutricionista/login</b> com o CPF/e-mail e troca depois).</p>}
          </section>

          <section className="mt-6 grid gap-2">
            {loading && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}
            {!loading && team.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma nutricionista na equipe ainda.</p>}
            {team.map((m) => (
              <div key={m.nutritionistId} className="panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{m.name} {m.crn && <span className="text-sm font-normal text-[var(--text-muted)]">· CRN {m.crn}{m.uf ? "-" + m.uf : ""}</span>}</p>
                    <p className="text-xs text-[var(--text-muted)]">{[m.cpf, m.email, m.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status && m.status !== "active" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{m.status === "pending" ? "Aguardando admin" : m.status}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.active ? "Ativa" : "Inativa"}</span>
                    <button type="button" className="btn-ghost text-sm" onClick={() => toggle(m)}>{m.active ? "Desativar" : "Ativar"}</button>
                    <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => remove(m)}>Remover</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-[var(--border)] pt-2">
                  {PERM_LABELS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 text-xs text-[var(--text-soft)]">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={m.permissions ? m.permissions[key] : true} onChange={(e) => setPerm(m, key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
