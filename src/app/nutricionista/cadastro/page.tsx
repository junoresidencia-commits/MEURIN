"use client";

import { useState } from "react";
import Link from "next/link";

type Doc = { name: string; url: string };

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

export default function NutricionistaCadastroPage() {
  const [form, setForm] = useState({ name: "", cpf: "", email: "", password: "", phone: "", crn: "", uf: "", specialty: "Nutrição", bio: "" });
  const [photo, setPhoto] = useState<string>("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 800000) { setError("Foto muito grande (máx. ~800 KB)."); return; }
    setPhoto(await fileToDataUrl(f));
  }
  async function onDocs(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const out: Doc[] = [];
    for (const f of files.slice(0, 5)) {
      if (f.size > 1400000) { setError(`"${f.name}" é muito grande (máx. ~1,4 MB).`); continue; }
      out.push({ name: f.name, url: await fileToDataUrl(f) });
    }
    setDocs((d) => [...d, ...out].slice(0, 5));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/nutricionista/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photoUrl: photo || undefined, documents: docs }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Falha no cadastro.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro"); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <p className="text-sm font-semibold text-[var(--green,#0d9488)]">Cadastro enviado</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Recebemos seu cadastro</h1>
        <div className="panel mt-6 space-y-3 text-[var(--text-soft)]">
          <p>Seu cadastro está <b>em análise pelo administrador</b>. Você poderá entrar assim que for aprovada.</p>
          <Link href="/nutricionista/login" className="btn-gold w-full">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <Link href="/nutricionista/login" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
      <p className="text-sm font-semibold text-[var(--gold)]">Área da nutricionista</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">Criar cadastro</h1>
      <p className="mt-2 text-[var(--text-muted)]">Cadastre-se para atender pacientes renais no Meu Rim. O acesso é liberado após aprovação do administrador.</p>

      <form onSubmit={submit} className="panel mt-6 grid gap-3 sm:grid-cols-2" noValidate>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo *</span><input className="input-field" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF *</span><input className="input-field" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">E-mail</span><input className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} inputMode="email" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Senha * (mín. 6)</span><input className="input-field" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Telefone</span><input className="input-field" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CRN *</span><input className="input-field" value={form.crn} onChange={(e) => set("crn", e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">UF</span><input className="input-field" value={form.uf} onChange={(e) => set("uf", e.target.value)} placeholder="BA" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade / atuação</span><input className="input-field" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Apresentação profissional</span><textarea className="input-field min-h-[70px]" value={form.bio} onChange={(e) => set("bio", e.target.value)} /></label>

        <div className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Foto (opcional)</span>
          <div className="flex items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Foto" className="h-16 w-16 rounded-full border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--text-muted)]">Foto</span>
            )}
            <input type="file" accept="image/png,image/jpeg" onChange={onPhoto} className="text-sm" />
          </div>
        </div>

        <div className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Documentos (diploma, CRN) — opcional</span>
          <input type="file" accept="image/*,application/pdf" multiple onChange={onDocs} className="text-sm" />
          {docs.length > 0 && <ul className="mt-1 text-xs text-[var(--text-muted)]">{docs.map((d, i) => <li key={i}>• {d.name}</li>)}</ul>}
        </div>

        {error && <p className="sm:col-span-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
        <div className="sm:col-span-2 flex items-center gap-3">
          <button type="submit" className="btn-gold" disabled={loading}>{loading ? "Enviando…" : "Enviar cadastro"}</button>
          <Link href="/nutricionista/login" className="text-sm font-semibold text-[var(--gold)]">Já tenho cadastro</Link>
        </div>
      </form>
    </div>
  );
}
