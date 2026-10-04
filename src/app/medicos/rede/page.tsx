"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { EncaminharPacienteForm } from "@/components/EncaminharPacienteForm";
import type { ProfessionalKind } from "@/lib/network-types";

type Card = {
  id: string;
  kind: ProfessionalKind;
  name: string;
  professionalName: string;
  profession: string;
  specialty: string;
  city: string | null;
  state: string | null;
  clinic: string | null;
  photoUrl: string | null;
  bio: string | null;
};

export default function RedeProfissionaisPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>}>
      <RedeProfissionaisInner />
    </Suspense>
  );
}

function RedeProfissionaisInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [clinic, setClinic] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [view, setView] = useState<Card | null>(null);
  const [refer, setRefer] = useState<Card | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    const ver = search.get("ver");
    if (!ver || !ready) return;
    const [kind, id] = ver.split(":");
    if (!kind || !id) return;
    fetch(`/api/network/professionals/${kind}/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.professional) setView(d.professional); });
  }, [search, ready]);

  async function runSearch() {
    setSearching(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (specialty.trim()) params.set("specialty", specialty.trim());
    if (city.trim()) params.set("city", city.trim());
    if (state.trim()) params.set("state", state.trim());
    if (clinic.trim()) params.set("clinic", clinic.trim());
    const res = await fetch(`/api/network/professionals?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    setResults(data.professionals || []);
    setSearching(false);
  }

  if (!ready) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]">Rede Meu Rim</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Pesquisar profissional</h1>
          <p className="mt-1 text-[var(--text-muted)]">
            Localize qualquer profissional cadastrado na plataforma — mesmo de outra clínica ou cidade. A busca mostra só informações profissionais.
          </p>

          <div className="panel mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome, profissão ou especialidade</span>
              <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: cardiologista, nutrição, Maria…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
              <input className="input-field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Cardiologia" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Cidade</span>
              <input className="input-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Irecê" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Estado</span>
              <input className="input-field" value={state} onChange={(e) => setState(e.target.value)} placeholder="BA" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Clínica / local</span>
              <input className="input-field" value={clinic} onChange={(e) => setClinic(e.target.value)} placeholder="Nome da clínica" />
            </label>
            <div className="sm:col-span-2">
              <button type="button" className="btn-gold" onClick={runSearch} disabled={searching}>
                {searching ? "Pesquisando…" : "Pesquisar profissional"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {results.map((p) => (
              <div key={`${p.kind}-${p.id}`} className="panel flex items-center gap-3">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-soft)] font-bold text-[var(--gold)]">
                    {(p.professionalName || p.name).slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-[var(--text)]">{p.professionalName || p.name}</p>
                  <p className="text-sm text-[var(--text-soft)]">
                    {p.profession}{p.specialty ? ` · ${p.specialty}` : ""}
                    {p.city ? ` · ${p.city}` : ""}{p.state ? `/${p.state}` : ""}
                    {p.clinic ? ` · ${p.clinic}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost text-sm" onClick={() => setView(p)}>Ver perfil</button>
                    <button type="button" className="btn-gold text-sm" onClick={() => setRefer(p)}>Encaminhar paciente</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DoctorMobileNav />

      {view && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-5" role="dialog">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6">
            <div className="flex items-start justify-between">
              <p className="font-display text-lg font-extrabold">Perfil profissional</p>
              <button type="button" onClick={() => setView(null)} aria-label="Fechar">×</button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {view.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--gold-soft)] font-bold text-[var(--gold)]">
                  {(view.professionalName || view.name).slice(0, 1)}
                </span>
              )}
              <div>
                <p className="font-bold">{view.professionalName || view.name}</p>
                <p className="text-sm text-[var(--text-soft)]">{view.profession} · {view.specialty}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              {[view.city, view.state].filter(Boolean).join(" / ") || "Cidade não informada"}
              {view.clinic ? ` · ${view.clinic}` : ""}
            </p>
            {view.bio && <p className="mt-3 text-sm text-[var(--text-soft)]">{view.bio}</p>}
            <button type="button" className="btn-gold mt-4" onClick={() => { setRefer(view); setView(null); }}>
              Encaminhar paciente
            </button>
          </div>
        </div>
      )}

      {refer && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
            <div className="mb-3 flex justify-between">
              <p className="font-display text-lg font-extrabold">Encaminhar paciente</p>
              <button type="button" onClick={() => setRefer(null)}>×</button>
            </div>
            <EncaminharPacienteForm
              preselected={{ kind: refer.kind, id: refer.id }}
              onDone={() => setRefer(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
