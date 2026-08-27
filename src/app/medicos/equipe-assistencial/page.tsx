"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Pro = {
  id: string; role: string; name: string; registry?: string | null; uf?: string | null;
  email?: string | null; phone?: string | null; status?: string; active?: boolean; specialty?: string | null;
};

type Payload = {
  mine: { nutrition: Pro[]; psychology: Pro[]; nursing: Pro[] };
  available: { nutrition: Pro[]; psychology: Pro[]; nursing: Pro[] };
};

const SPECS: { id: "nutrition" | "psychology" | "nursing"; title: string; registry: string }[] = [
  { id: "nutrition", title: "Nutrição", registry: "CRN" },
  { id: "psychology", title: "Psicologia", registry: "CRP" },
  { id: "nursing", title: "Enfermagem", registry: "COREN" },
];

export default function MinhaEquipePage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<(typeof SPECS)[number]["id"]>("nutrition");
  const [form, setForm] = useState({ name: "", cpf: "", email: "", phone: "", registry: "", uf: "" });
  const [msg, setMsg] = useState("");
  const [newPass, setNewPass] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    const auth = await fetch("/api/auth").then((r) => r.json());
    if (!auth.doctor) { router.replace("/medicos/login"); return; }
    const res = await fetch("/api/doctor/care-team");
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.error || !d.mine || !d.available) {
      setError(d.error || "Não foi possível carregar a equipe.");
      setData(null);
    } else {
      setData(d);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filter = (list: Pro[]) => {
    const s = q.toLowerCase().trim();
    if (!s) return list;
    return list.filter((p) => [p.name, p.registry, p.email, p.phone].filter(Boolean).join(" ").toLowerCase().includes(s));
  };

  const mine = useMemo(() => filter(data?.mine?.[spec] || []), [data, spec, q]);
  const available = useMemo(() => filter(data?.available?.[spec] || []), [data, spec, q]);
  const availableTotal = data?.available?.[spec]?.length || 0;
  const mineTotal = data?.mine?.[spec]?.length || 0;
  const meta = SPECS.find((s) => s.id === spec)!;

  async function addExisting(p: Pro) {
    setSaving(true); setMsg(""); setNewPass(null);
    try {
      const res = await fetch("/api/doctor/care-team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: spec, professionalId: p.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      setMsg(`${p.name} foi adicionada à sua equipe.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  async function create() {
    if (!form.name || (!form.cpf && !form.email)) { setMsg("Informe nome e CPF e/ou e-mail."); return; }
    setSaving(true); setMsg(""); setNewPass(null);
    try {
      const res = await fetch("/api/doctor/care-team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: spec, ...form }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erro");
      if (d.created && d.defaultPassword) { setNewPass(d.defaultPassword); setMsg("Profissional criado e vinculado."); }
      else setMsg(d.message || "Profissional vinculado à sua equipe.");
      setForm({ name: "", cpf: "", email: "", phone: "", registry: "", uf: "" });
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  async function toggle(p: Pro) {
    await fetch("/api/doctor/care-team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: spec, professionalId: p.id, active: !p.active }) });
    await load();
  }
  async function remove(p: Pro) {
    if (!window.confirm(`Remover ${p.name} da sua equipe? O histórico dos pacientes será preservado.`)) return;
    await fetch("/api/doctor/care-team", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: spec, professionalId: p.id }) });
    await load();
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/mais" className="text-sm font-semibold text-[var(--gold)]">← Mais</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Minha Equipe</h1>
          <p className="mt-1 text-[var(--text-muted)]">Nutrição, psicologia e enfermagem. Quem já se cadastrou aparece em disponíveis — clique em Adicionar para entrar na sua equipe. O profissional só vê os pacientes que você encaminhar.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {SPECS.map((s) => {
              const avail = data?.available?.[s.id]?.length || 0;
              const mineN = data?.mine?.[s.id]?.length || 0;
              return (
                <button key={s.id} type="button" onClick={() => setSpec(s.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${spec === s.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
                  {s.title}
                  {avail > 0 && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${spec === s.id ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{avail} disponível{avail > 1 ? "is" : ""}</span>}
                  {avail === 0 && mineN > 0 && <span className={`ml-2 text-[10px] font-semibold ${spec === s.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>{mineN}</span>}
                </button>
              );
            })}
          </div>
          <input className="input-field mt-4" placeholder="Pesquisar por nome, e-mail ou registro" value={q} onChange={(e) => setQ(e.target.value)} />
          {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
          {msg && <p className="mt-3 text-sm font-semibold text-[var(--text-soft)]">{msg}</p>}
          {newPass && <p className="mt-3 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm">Senha inicial: <b>{newPass}</b></p>}

          {loading && <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando profissionais…</p>}

          {!loading && (
            <>
          {availableTotal > 0 && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {availableTotal === 1 ? "Há 1 profissional cadastrado no Meu Rim pronto para entrar na sua equipe." : `Há ${availableTotal} profissionais cadastrados no Meu Rim prontos para entrar na sua equipe.`}
            </p>
          )}

          <section className="mt-6">
            <h2 className="font-display text-xl">Profissionais disponíveis</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Quem já se cadastrou e ainda não está na sua equipe. Adicionar também libera o acesso (não precisa esperar o admin).</p>
            <div className="mt-3 grid gap-2">
              {!loading && available.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum profissional disponível nesta especialidade.</p>}
              {available.map((p) => (
                <div key={p.id} className="panel flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{p.name} {p.registry && <span className="text-sm font-normal text-[var(--text-muted)]">· {meta.registry} {p.registry}{p.uf ? `-${p.uf}` : ""}</span>}</p>
                    <p className="text-xs text-[var(--text-muted)]">{[p.email, p.phone].filter(Boolean).join(" · ") || "—"}</p>
                    {p.status === "pending" && <p className="mt-1 text-xs font-semibold text-amber-700">Cadastro pendente — ao adicionar, o acesso é liberado</p>}
                  </div>
                  <button type="button" className="btn-gold text-sm" onClick={() => addExisting(p)} disabled={saving}>Adicionar à equipe</button>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-xl">Minha equipe</h2>
            <div className="mt-3 grid gap-2">
              {!loading && mine.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">
                  {mineTotal === 0 && availableTotal > 0
                    ? "Ninguém nesta especialidade ainda. Use Adicionar à equipe acima."
                    : "Nenhum profissional nesta especialidade."}
                </p>
              )}
              {mine.map((p) => (
                <div key={p.id} className="panel flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{p.name} {p.registry && <span className="text-sm font-normal text-[var(--text-muted)]">· {meta.registry} {p.registry}{p.uf ? `-${p.uf}` : ""}</span>}</p>
                    <p className="text-xs text-[var(--text-muted)]">{[p.email, p.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{p.active ? "Ativo" : "Inativo"}</span>
                    <button type="button" className="btn-ghost text-sm" onClick={() => toggle(p)}>{p.active ? "Desativar" : "Ativar"}</button>
                    <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => remove(p)}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <details className="panel mt-8" open={availableTotal === 0 && mineTotal === 0}>
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wider text-[var(--gold)]">Cadastrar nova {meta.title.toLowerCase()}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome</span><input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF</span><input className="input-field" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span><input className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span><input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{meta.registry}</span><input className="input-field" value={form.registry} onChange={(e) => setForm({ ...form, registry: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF</span><input className="input-field" value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} /></label>
              <div className="sm:col-span-2"><button type="button" className="btn-gold" onClick={create} disabled={saving}>{saving ? "Salvando…" : "Adicionar profissional"}</button></div>
            </div>
          </details>

          {spec === "nutrition" && (
            <p className="mt-6 text-xs text-[var(--text-muted)]">Permissões detalhadas da nutrição (exames, diário, plano) continuam em <Link href="/medicos/equipe-nutricao" className="font-semibold text-[var(--gold)]">Equipe de Nutrição</Link>.</p>
          )}
            </>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
