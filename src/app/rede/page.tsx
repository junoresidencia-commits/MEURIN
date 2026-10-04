"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EncaminharPacienteForm } from "@/components/EncaminharPacienteForm";
import { CreatePatient } from "@/components/CreatePatient";
import type { ProfessionalKind } from "@/lib/network-types";

type Card = {
  id: string;
  kind: ProfessionalKind;
  name: string;
  professionalName: string;
  profession: string;
  specialty: string;
  city: string | null;
  clinic: string | null;
  photoUrl: string | null;
};

export default function RedePage() {
  const [ok, setOk] = useState(false);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<Card[]>([]);
  const [refer, setRefer] = useState<Card | null>(null);
  const [create, setCreate] = useState(false);

  useEffect(() => {
    fetch("/api/network/professionals?q=a").then((r) => {
      setOk(r.status !== 401);
    });
  }, []);

  async function search() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (specialty.trim()) params.set("specialty", specialty.trim());
    if (city.trim()) params.set("city", city.trim());
    const res = await fetch(`/api/network/professionals?${params.toString()}`);
    const d = await res.json().catch(() => ({}));
    setResults(d.professionals || []);
  }

  if (!ok) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-sm text-[var(--text-muted)]">
        Entre como profissional para pesquisar a rede do Meu Rim.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Rede de profissionais</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Pesquise qualquer profissional cadastrado no Meu Rim e encaminhe um paciente sem vínculo prévio.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/encaminhamentos" className="btn-ghost text-sm">Pacientes encaminhados para mim</Link>
        <button type="button" className="btn-gold text-sm" onClick={() => setCreate((v) => !v)}>
          Cadastrar paciente
        </button>
      </div>
      {create && <CreatePatient onCreated={() => setCreate(false)} />}
      <div className="panel mt-5 grid gap-3">
        <input className="input-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar profissional" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input-field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Especialidade" />
          <input className="input-field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
        </div>
        <button type="button" className="btn-gold" onClick={search}>Pesquisar profissional</button>
      </div>
      <div className="mt-4 grid gap-3">
        {results.map((p) => (
          <div key={`${p.kind}-${p.id}`} className="panel flex items-center gap-3">
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--gold-soft)] font-bold text-[var(--gold)]">
                {(p.professionalName || p.name).slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.professionalName || p.name}</p>
              <p className="text-sm text-[var(--text-soft)]">
                {p.profession}{p.specialty ? ` · ${p.specialty}` : ""}{p.city ? ` · ${p.city}` : ""}{p.clinic ? ` · ${p.clinic}` : ""}
              </p>
              <button type="button" className="btn-gold mt-2 text-sm" onClick={() => setRefer(p)}>Encaminhar paciente</button>
            </div>
          </div>
        ))}
      </div>
      {refer && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
            <div className="mb-3 flex justify-between">
              <p className="font-display text-lg font-extrabold">Encaminhar paciente</p>
              <button type="button" onClick={() => setRefer(null)}>×</button>
            </div>
            <EncaminharPacienteForm preselected={{ kind: refer.kind, id: refer.id }} onDone={() => setRefer(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
