"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type DoctorLink = {
  id: string;
  title: string;
  url: string;
  category?: string | null;
  note?: string | null;
};

const SUGGESTED = [
  "Doença Renal Crônica",
  "Anemia",
  "CEAF",
  "Hipertensão",
  "Diabetes",
  "Diálise",
  "Transplante",
  "Distúrbio mineral ósseo",
];

export default function LinksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<DoctorLink[]>([]);
  const [form, setForm] = useState({ title: "", url: "", category: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/doctor/links").then((r) => (r.ok ? r.json() : { links: [] })),
    ]).then(([auth, data]) => {
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      setLinks(data.links || []);
      setLoading(false);
    });
  }, [router]);

  const grouped = useMemo(() => {
    const map = new Map<string, DoctorLink[]>();
    for (const l of links) {
      const cat = (l.category || "").trim() || "Sem categoria";
      const arr = map.get(cat) || [];
      arr.push(l);
      map.set(cat, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [links]);

  async function addLink() {
    setError("");
    if (!form.title.trim() || !form.url.trim()) {
      setError("Preencha título e link.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/doctor/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.");
      setLinks((ls) => [data.link, ...ls]);
      setForm({ title: "", url: "", category: form.category, note: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id: string, title: string) {
    if (!window.confirm(`Excluir o link "${title}"?`)) return;
    const res = await fetch("/api/doctor/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setLinks((ls) => ls.filter((l) => l.id !== id));
  }

  function hostOf(url: string): string {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">Links úteis</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">
            Seus links e referências
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Guarde aqui os links que você mais usa (protocolos CEAF, referências de anemia, doença
            renal crônica etc.), organizados por condição — assim você não precisa sair do site para
            procurar.
          </p>

          {/* Formulário */}
          <div className="panel mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Adicionar link</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Título</span>
                <input
                  className="input-field"
                  placeholder="Ex.: Protocolo CEAF — Anemia na DRC"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Condição / categoria</span>
                <input
                  className="input-field"
                  list="link-categorias"
                  placeholder="Ex.: Anemia, Doença Renal Crônica, CEAF…"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <datalist id="link-categorias">
                  {SUGGESTED.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Link (URL)</span>
              <input
                className="input-field"
                inputMode="url"
                placeholder="cole o link aqui (ex.: https://…)"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Observação (opcional)</span>
              <input
                className="input-field"
                placeholder="Ex.: usar para baixar o PDF oficial"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button
              type="button"
              className="btn-gold"
              onClick={addLink}
              disabled={saving || !form.title.trim() || !form.url.trim()}
            >
              {saving ? "Salvando…" : "Salvar link"}
            </button>
          </div>

          {/* Lista agrupada por condição */}
          <div className="mt-8 space-y-6">
            {loading && <p className="text-[var(--text-muted)]">Carregando…</p>}
            {!loading && links.length === 0 && (
              <p className="text-[var(--text-muted)]">
                Nenhum link salvo ainda. Adicione o primeiro acima.
              </p>
            )}
            {grouped.map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--gold-light)]">
                  {category}
                </h2>
                <div className="grid gap-3">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      className="panel flex items-center justify-between gap-3 transition hover:border-[var(--border-gold)]"
                    >
                      <div className="min-w-0">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-semibold text-[var(--text)] hover:text-[var(--gold)]"
                        >
                          {l.title}
                        </a>
                        <p className="truncate text-xs text-[var(--text-muted)]">{hostOf(l.url)}</p>
                        {l.note && <p className="mt-1 text-sm text-[var(--text-soft)]">{l.note}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-white px-3 py-2 text-sm font-semibold text-[var(--gold)] transition hover:border-[var(--gold)]"
                        >
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => removeLink(l.id, l.title)}
                          className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                          aria-label={`Excluir link ${l.title}`}
                          title="Excluir link"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
