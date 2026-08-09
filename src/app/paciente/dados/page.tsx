"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toFriendlyMessage } from "@/lib/user-errors";

export default function MeusDadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: "", cpf: "", phone: "", email: "", birthdate: "", sex: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/patient/me")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/paciente/entrar");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (!d.found) setNotFound(true);
        else setForm((f) => ({ ...f, ...d.patient }));
      })
      .finally(() => setLoading(false));
  }, [router]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg("");
    setErr("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/patient/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, birthdate: form.birthdate, sex: form.sex }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setMsg("Dados atualizados.");
    } catch (e) {
      setErr(toFriendlyMessage(e, "Não foi possível salvar seus dados."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-md px-5 py-16 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/paciente/inicio" className="text-sm font-semibold text-[var(--gold)]">← Início</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Meus dados</h1>

      {notFound ? (
        <p className="panel mt-6 text-sm text-[var(--text-soft)]">
          Seu acesso é por e-mail de agendamento e ainda não tem um cadastro editável. Para completar seus dados, fale com seu médico na consulta.
        </p>
      ) : (
        <form onSubmit={save} className="panel mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Nome completo</span>
            <input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF</span>
              <input className="input-field bg-[var(--bg-soft)]" value={form.cpf} readOnly />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span>
              <input className="input-field" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Data de nascimento</span>
              <input type="date" className="input-field" value={form.birthdate ? String(form.birthdate).slice(0, 10) : ""} onChange={(e) => set("birthdate", e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Sexo</span>
              <select className="input-field" value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                <option value="">—</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </label>
          </div>
          {form.email && <p className="text-xs text-[var(--text-muted)]">E-mail: {form.email} (alterações de e-mail/CPF são feitas na consulta).</p>}
          {msg && <p className="text-sm text-[var(--green)]">{msg}</p>}
          {err && <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}
          <button type="submit" className="btn-gold w-full" disabled={saving}>{saving ? "Salvando…" : "Salvar meus dados"}</button>
        </form>
      )}
    </div>
  );
}
