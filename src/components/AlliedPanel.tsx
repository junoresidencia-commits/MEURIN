"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AlliedRole } from "@/lib/allied-types";
import { StartCareCallButton } from "@/components/StartCareCallButton";
import { CreatePatient } from "@/components/CreatePatient";
import { ProfessionalProfileCard } from "@/components/ProfessionalProfileCard";

type Pro = {
  name: string;
  registry?: string | null;
  uf?: string | null;
  city?: string | null;
  specialty?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  pixProfile?: { key?: string | null } | null;
};
type Me = { professional: Pro; doctors: { id: string; name: string }[] };
type Patient = { key: string; name: string; reason?: string | null; at: string };

const META: Record<AlliedRole, { title: string; registry: string; base: string }> = {
  psychology: { title: "Psicologia", registry: "CRP", base: "/psicologo" },
  nursing: { title: "Enfermagem", registry: "COREN", base: "/enfermeiro" },
};

export function AlliedPanel({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const meta = META[role];
  const [me, setMe] = useState<Me | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/allied/me");
      if (meRes.status === 401) { router.replace(`${meta.base}/login`); return; }
      const meData = await meRes.json();
      if (meData.professional?.role && meData.professional.role !== role) {
        router.replace(meData.professional.role === "nursing" ? "/enfermeiro/painel" : "/psicologo/painel");
        return;
      }
      setMe(meData);
      const pRes = await fetch("/api/allied/patients");
      const pData = await pRes.json();
      setPatients(pData.patients || []);
      setLoading(false);
    })();
  }, [meta.base, role, router]);

  async function logout() {
    await fetch("/api/allied/session", { method: "DELETE" });
    router.push(`${meta.base}/login`);
  }

  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : patients;
  const missing: string[] = [];
  if (!me?.professional.photoUrl) missing.push("foto");
  if (!me?.professional.city) missing.push("cidade");
  if (!me?.professional.specialty) missing.push("especialidade");
  if (!me?.professional.bio) missing.push("bio");
  if (!me?.professional.pixProfile?.key) missing.push("chave Pix");
  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`${meta.base}/configuracoes`} className="shrink-0" aria-label="Editar foto e perfil">
            {me?.professional.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.professional.photoUrl} alt="Sua foto" className="h-14 w-14 rounded-full border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">
                {(me?.professional.name || meta.title).slice(0, 2).toUpperCase()}
              </span>
            )}
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">{meta.title}</p>
            <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Olá, {me?.professional.name?.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {me?.professional.registry ? `${meta.registry} ${me.professional.registry}${me.professional.uf ? "-" + me.professional.uf : ""} · ` : ""}
              {me?.professional.city ? `${me.professional.city} · ` : ""}
              {me?.professional.specialty ? `${me.professional.specialty} · ` : ""}
              Vinculado a {me?.doctors.length || 0} médico(s)
            </p>
            <Link href={`${meta.base}/configuracoes`} className="mt-1 inline-block text-sm font-semibold text-[var(--gold)]">
              {me?.professional.photoUrl ? "Editar foto e perfil →" : "Adicionar foto e completar perfil →"}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/rede" className="btn-ghost">Pesquisar profissional</Link>
          <Link href="/encaminhamentos" className="btn-ghost">Pacientes encaminhados</Link>
          <Link href={`${meta.base}/configuracoes`} className="btn-ghost">Perfil e recebimentos</Link>
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      <ProfessionalProfileCard
        photoEndpoint="/api/allied/photo"
        settingsHref={`${meta.base}/configuracoes`}
        name={me?.professional.name || meta.title}
        missing={missing}
        onPhotoChange={(url) =>
          setMe((cur) => (cur ? { ...cur, professional: { ...cur.professional, photoUrl: url } } : cur))
        }
      />

      <section className="mt-6">
        <CreatePatient onCreated={() => window.location.reload()} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Meus Pacientes</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Somente pacientes encaminhados a você.</p>
        <input className="input-field mt-3" placeholder="Pesquisar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 grid gap-2">
          {filtered.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum paciente encaminhado. Quando o médico enviar alguém, você atende online daqui — mesma sala de vídeo e evolução da consulta.
            </p>
          )}
          {filtered.map((p) => (
            <div key={p.key} className="panel flex flex-wrap items-center justify-between gap-3 transition hover:border-[var(--border-gold)]">
              <Link href={`${meta.base}/paciente/${encodeURIComponent(p.key)}`} className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--text)]">{p.name}</p>
                {p.reason && <p className="text-xs text-[var(--text-muted)]">{p.reason}</p>}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <StartCareCallButton patientKey={p.key} label="Consulta online" />
                <Link href={`${meta.base}/paciente/${encodeURIComponent(p.key)}`} className="text-sm font-semibold text-[var(--gold)]">Prontuário →</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
