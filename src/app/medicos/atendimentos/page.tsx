"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking } from "@/lib/types";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { PatientQuickSheet } from "@/components/PatientQuickSheet";
import { MarkPaidButton } from "@/components/MarkPaidButton";

type Tab = "hoje" | "proximas" | "realizadas" | "todas";
const TABS: { id: Tab; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "proximas", label: "Próximas" },
  { id: "realizadas", label: "Realizadas" },
  { id: "todas", label: "Todas" },
];

function statusMeta(b: Booking): { label: string; color: string } {
  if (b.stage === "proposto_novo_horario") return { label: "Novo horário proposto", color: "#e08a2e" };
  if (b.status === "confirmed") return { label: "Confirmada", color: "#1a9a78" };
  if (b.status === "completed" || b.stage === "realizada") return { label: "Realizada", color: "#1a9a78" };
  if (b.status === "paid") return { label: "Aguardando", color: "#e4a32e" };
  if (b.status === "pending_payment") return { label: "Aguardando pgto.", color: "#e4a32e" };
  if (b.status === "cancelled") return { label: "Cancelada", color: "#e86761" };
  return { label: "Agendada", color: "#2b7fb0" };
}

export default function AtendimentosPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("hoje");
  const [quickKey, setQuickKey] = useState<string | null>(null);

  function load() {
    setError("");
    fetch("/api/bookings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar os atendimentos."))))
      .then((d) => setBookings(d.bookings || []))
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((a) => { if (!a.doctor) router.replace("/medicos/login"); else load(); }).catch(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = Date.now();
  const todayStr = new Date().toDateString();
  const all = (bookings || []).slice().sort((a, b) => b.slotStart.localeCompare(a.slotStart));
  const list = all.filter((b) => {
    if (tab === "hoje") return new Date(b.slotStart).toDateString() === todayStr && b.status !== "cancelled";
    if (tab === "proximas") return new Date(b.slotStart).getTime() > now && b.status !== "cancelled";
    if (tab === "realizadas") return b.status === "completed" || b.stage === "realizada";
    return true;
  });
  const counts = {
    hoje: all.filter((b) => new Date(b.slotStart).toDateString() === todayStr && b.status !== "cancelled").length,
    proximas: all.filter((b) => new Date(b.slotStart).getTime() > now && b.status !== "cancelled").length,
    realizadas: all.filter((b) => b.status === "completed" || b.stage === "realizada").length,
    todas: all.length,
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">Atendimentos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Histórico e próximos atendimentos. Toque num paciente para o resumo rápido.</p>

          <div className="mt-4 -mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === t.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)]"}`}>
                  {t.label}{bookings ? <span className={`ml-1 ${tab === t.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>{counts[t.id]}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="mt-6 rounded-xl border border-[var(--danger)]/30 bg-[#fdecea] p-4 text-sm text-[var(--danger)]">{error} <button type="button" className="ml-2 font-semibold underline" onClick={load}>Tentar novamente</button></div>}
          {!bookings && !error && <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-[var(--gold-soft)]/60" />)}</div>}
          {bookings && list.length === 0 && !error && <p className="mt-8 text-sm text-[var(--text-muted)]">Nenhum atendimento neste filtro.</p>}

          {bookings && list.length > 0 && (
            <ul className="mt-4 space-y-2">
              {list.map((b) => {
                const st = statusMeta(b);
                const dt = new Date(b.slotStart);
                return (
                  <li key={b.id} className="panel !p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-center">
                        <p className="font-display text-sm text-[var(--text)]">{dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                        <p className="text-xs text-[var(--text-muted)]">{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <button type="button" onClick={() => setQuickKey(b.patientEmail)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-[var(--text)] hover:text-[var(--gold)]">{b.patientName}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{[b.locationName || (b.modality === "teleconsulta" ? "Teleconsulta" : null), b.careReason === "acompanhamento" ? "Retorno" : "Consulta"].filter(Boolean).join(" • ")}</p>
                      </button>
                      <span className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: st.color, background: `${st.color}1a` }}>{st.label}</span>
                      {b.status === "pending_payment" && (
                        <MarkPaidButton bookingId={b.id} compact onDone={load} />
                      )}
                      <Link href={`/medicos/paciente/${encodeURIComponent(b.patientEmail)}`} className="shrink-0 text-[var(--gold)]">›</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <DoctorMobileNav />
      {quickKey && <PatientQuickSheet patientKey={quickKey} onClose={() => setQuickKey(null)} />}
    </div>
  );
}
