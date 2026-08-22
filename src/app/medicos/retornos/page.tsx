"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Item = {
  id: string;
  patientKey: string;
  patientName: string;
  dueAt: string;
  intervalLabel: string | null;
  eff: "atrasado" | "prox7" | "prox30" | "programado" | "agendado";
  daysLate: number;
  nextConsultation: string | null;
  phone: string | null;
};
type Buckets = { atrasados: Item[]; prox7: Item[]; prox30: Item[]; agendados: Item[] };

const TABS: { id: keyof Buckets; label: string }[] = [
  { id: "atrasados", label: "Atrasados" },
  { id: "prox7", label: "Próx. 7 dias" },
  { id: "prox30", label: "Próx. 30 dias" },
  { id: "agendados", label: "Agendados" },
];

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function RetornosPage() {
  const router = useRouter();
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<keyof Buckets>("atrasados");

  function load() {
    setError("");
    fetch("/api/doctor/returns")
      .then((r) => { if (r.status === 401) { router.replace("/medicos/login"); return null; } return r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar os retornos.")); })
      .then((d) => { if (d) setBuckets(d.buckets); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(id: string) {
    await fetch("/api/doctor/returns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "done" }) });
    load();
  }
  function whats(it: Item) {
    const digits = (it.phone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `Olá, ${it.patientName}! Passando para combinar seu retorno no Meu Rim. Podemos agendar?`;
    const url = withCountry ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const list = buckets ? buckets[tab] : [];

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">Central de retornos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Pacientes que precisam retornar. Um retorno some daqui quando existe uma consulta futura marcada.</p>

          <div className="mt-4 -mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
                  {t.label}{buckets ? <span className={`ml-1 ${tab === t.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>{buckets[t.id].length}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-[var(--danger)]/30 bg-[#fdecea] p-4 text-sm text-[var(--danger)]">
              {error} <button type="button" className="ml-2 font-semibold underline" onClick={load}>Tentar novamente</button>
            </div>
          )}
          {!buckets && !error && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--gold-soft)]/60" />)}</div>}

          {buckets && list.length === 0 && !error && (
            <p className="mt-8 text-sm text-[var(--text-muted)]">{tab === "atrasados" ? "✓ Nenhum retorno atrasado." : "Nenhum retorno neste período."}</p>
          )}

          {buckets && list.length > 0 && (
            <ul className="mt-4 space-y-3">
              {list.map((it) => (
                <li key={it.id} className="panel !p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg text-[var(--text)]">{it.patientName}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        Previsto: {fmt(it.dueAt)}
                        {it.eff === "atrasado" && <span className="ml-2 font-semibold text-[var(--danger)]">🔴 {it.daysLate} {it.daysLate === 1 ? "dia" : "dias"} atrasado</span>}
                        {it.eff === "prox7" && <span className="ml-2 font-semibold text-[#e08a2e]">🟠 chegando</span>}
                        {it.eff === "agendado" && it.nextConsultation && <span className="ml-2 font-semibold text-[var(--green)]">🟢 consulta em {fmt(it.nextConsultation)}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/medicos/paciente/${encodeURIComponent(it.patientKey)}`} className="btn-gold text-sm">Agendar / Abrir</Link>
                      <button type="button" className="btn-ghost text-sm" onClick={() => whats(it)}>WhatsApp</button>
                      <button type="button" className="btn-ghost text-sm text-[var(--text-muted)]" onClick={() => resolve(it.id)}>Resolvido</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
