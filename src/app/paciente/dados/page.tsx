"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toFriendlyMessage } from "@/lib/user-errors";
import { disablePush, enablePush, isSubscribed, pushSupported } from "@/lib/push-client";

export default function MeusDadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: "", cpf: "", phone: "", email: "", birthdate: "", sex: "", photoUrl: "" });
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

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Selecione uma imagem (PNG/JPG)."); return; }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 320;
          let { width, height } = img;
          if (width > max || height > max) { const r = Math.min(max / width, max / height); width = Math.round(width * r); height = Math.round(height * r); }
          const c = document.createElement("canvas"); c.width = width; c.height = height;
          const ctx = c.getContext("2d"); if (!ctx) return reject(new Error("Canvas"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject; img.src = String(reader.result);
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
    set("photoUrl", dataUrl);
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
        body: JSON.stringify({ name: form.name, phone: form.phone, birthdate: form.birthdate, sex: form.sex, photoUrl: form.photoUrl }),
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
          <div className="flex items-center gap-4">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoUrl} alt="Sua foto" className="h-16 w-16 rounded-full border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">{(form.name || "P").slice(0, 2).toUpperCase()}</span>
            )}
            <div className="flex flex-col gap-2">
              <label className="btn-ghost cursor-pointer text-sm">
                {form.photoUrl ? "Trocar foto" : "Adicionar foto"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickPhoto} />
              </label>
              {form.photoUrl && <button type="button" className="text-xs font-semibold text-[var(--danger)]" onClick={() => set("photoUrl", "")}>Remover foto</button>}
            </div>
          </div>
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

      <PatientNotificationsCard />
    </div>
  );
}

function PatientNotificationsCard() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setSupported(pushSupported());
    isSubscribed().then(setSubscribed);
  }, []);

  async function ativar() {
    setMsg("");
    const r = await enablePush();
    if (r.ok) {
      setSubscribed(true);
      setMsg("Lembretes ativados neste aparelho.");
    } else if (r.reason === "denied") {
      setMsg("Permissão negada. Ative nas configurações do navegador.");
    } else if (r.reason === "not_configured") {
      setMsg("As notificações ainda não foram configuradas no servidor.");
    } else if (r.reason === "unsupported") {
      setSupported(false);
    } else {
      setMsg("Não foi possível ativar agora.");
    }
  }
  async function desativar() {
    await disablePush();
    setSubscribed(false);
    setMsg("Lembretes desativados neste aparelho.");
  }

  return (
    <section className="panel mt-6">
      <h2 className="font-display text-xl text-[var(--text)]">Lembretes e avisos</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Receba avisos das suas consultas e lembretes 24h e 2h antes. Sem dados de saúde nas notificações.
      </p>
      {!supported ? (
        <p className="mt-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
          Para receber no iPhone, toque em Compartilhar → “Adicionar à Tela de Início” e abra o Meu Rim por lá.
        </p>
      ) : (
        <div className="mt-3">
          {subscribed ? (
            <button type="button" className="btn-ghost" onClick={desativar}>Desativar lembretes neste aparelho</button>
          ) : (
            <button type="button" className="btn-gold" onClick={ativar}>Ativar lembretes</button>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
    </section>
  );
}
