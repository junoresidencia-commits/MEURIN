"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import type { AlliedRole } from "@/lib/allied-types";

type Me = { professional: { name: string; registry?: string | null; uf?: string | null }; doctors: { id: string; name: string }[] };
type Patient = { key: string; name: string; reason?: string | null; doctorName?: string | null; at: string };
type Referral = { id: string; patientKey: string; patientName?: string | null; reason?: string | null; doctorName?: string | null; status: string };

const META: Record<AlliedRole, { title: string; registry: string; base: string }> = {
  psychology: { title: "Psicologia", registry: "CRP", base: "/psicologo" },
  nursing: { title: "Enfermagem", registry: "COREN", base: "/enfermeiro" },
};

export function AlliedPanel({ role }: { role: AlliedRole }) {
  const router = useRouter();
  const meta = META[role];
  const [me, setMe] = useState<Me | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState<Record<string, number>>({});

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
      setReferrals(pData.referrals || []);
      const u = await fetch("/api/care-messages/unread").then((r) => r.json()).catch(() => ({ counts: {} }));
      setUnread(u.counts || {});
      setLoading(false);
    })();
  }, [meta.base, role, router]);

  async function logout() {
    await fetch("/api/allied/session", { method: "DELETE" });
    router.push(`${meta.base}/login`);
  }

  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : patients;
  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">{meta.title}</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Olá, {me?.professional.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {me?.professional.registry ? `${meta.registry} ${me.professional.registry}${me.professional.uf ? "-" + me.professional.uf : ""} · ` : ""}
            Vinculado a {me?.doctors.length || 0} médico(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Encaminhamentos</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Quando um médico encaminha, o nome do paciente aparece aqui.</p>
        {referrals.filter((r) => r.status === "aberto").length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum encaminhamento em aberto.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {referrals.filter((r) => r.status === "aberto").map((r) => (
              <Link key={r.id} href={`${meta.base}/paciente/${encodeURIComponent(r.patientKey)}`} className="panel flex items-center justify-between transition hover:border-[var(--border-gold)]">
                <div>
                  <p className="font-semibold text-[var(--text)]">{r.patientName || "Paciente"}</p>
                  {r.reason && <p className="text-sm text-[var(--text-muted)]">{r.reason}</p>}
                  <p className="text-xs text-[var(--text-muted)]">Encaminhado por {r.doctorName || "médico"}</p>
                </div>
                <span className="text-[var(--gold)]">Abrir →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Meus Pacientes</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Somente pacientes encaminhados a você.</p>
        <input className="input-field mt-3" placeholder="Pesquisar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 grid gap-2">
          {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum paciente encaminhado.</p>}
          {filtered.map((p) => (
            <Link key={p.key} href={`${meta.base}/paciente/${encodeURIComponent(p.key)}`} className="panel flex items-center justify-between transition hover:border-[var(--border-gold)]">
              <div>
                <p className="font-semibold text-[var(--text)]">{p.name}</p>
                {p.reason && <p className="text-xs text-[var(--text-muted)]">{p.reason}</p>}
                {p.doctorName && <p className="text-xs text-[var(--text-muted)]">Encaminhado por {p.doctorName}</p>}
              </div>
              <div className="flex items-center gap-2">
                {unread[p.key] ? <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[11px] font-bold text-white">{unread[p.key]}</span> : null}
                <span className="text-[var(--gold)]">Abrir →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
