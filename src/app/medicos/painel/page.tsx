"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Booking, Doctor } from "@/lib/types";
import { formatBRL, formatSlotLabel } from "@/lib/scheduling-client";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import { EnableNotifications } from "@/components/EnableNotifications";
import { GlobalPatientSearch } from "@/components/GlobalPatientSearch";
import { PatientQuickSheet } from "@/components/PatientQuickSheet";
import { QrCode } from "@/components/QrCode";
import { SITE_URL, patientAccessMessage } from "@/lib/site";

function consultaStatus(b: Booking): { emoji: string; label: string; color: string } {
  if (b.stage === "proposto_novo_horario") return { emoji: "🟠", label: "Novo horário proposto", color: "#e08a2e" };
  if (b.status === "confirmed") return { emoji: "🟢", label: "Confirmado", color: "#1a9a78" };
  if (b.status === "completed") return { emoji: "🟢", label: "Concluído", color: "#1a9a78" };
  if (b.status === "paid") return { emoji: "🟡", label: "Aguardando", color: "#e4a32e" };
  if (b.status === "pending_payment") return { emoji: "🟡", label: "Aguardando pgto.", color: "#e4a32e" };
  return { emoji: "🔵", label: "Agendado", color: "#2b7fb0" };
}

type Pair = { v: number; delta: number | null };
type Dashboard = {
  counts: { pacientes: number; consultasHoje: number; retornosPendentes: number; retornosAtrasados: number; novosExames: number; alertas: number; lmeParaAssinar: number; aguardando: number; pendencias: number };
  continuar: { patientKey: string; patientName: string; startedAt: string } | null;
  recentExams: { patientKey: string; patientName: string; testKey: string; testLabel: string; value: number; unit: string | null; measuredAt: string; createdAt: string }[];
  alertas: { patientKey: string; patientName: string; level: "urgente" | "importante"; text: string; date: string }[];
  pendencias: { label: string; count: number; href: string }[];
  resumo: { consultasRealizadas: Pair; novosPacientes: Pair; retornosRealizados: Pair; examesImportados: Pair; lmeEmitidas: Pair; receitaCents: Pair };
};

type ReturnItem = { id: string; patientKey: string; patientName: string; dueAt: string; eff: string; daysLate: number; nextConsultation: string | null; phone: string | null };
type ReturnsBuckets = { atrasados: ReturnItem[]; prox7: ReturnItem[]; prox30: ReturnItem[]; agendados: ReturnItem[] };

function fmtDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function DeltaTag({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-[11px] text-[var(--text-muted)]">vs. 7 dias anteriores</span>;
  const up = delta >= 0;
  return (
    <span className="text-[11px] font-semibold" style={{ color: up ? "#1a9a78" : "#e86761" }}>
      {up ? "↑" : "↓"} {Math.abs(delta)}% <span className="font-normal text-[var(--text-muted)]">vs. 7 dias ant.</span>
    </span>
  );
}
function MetricCard({ href, onClick, icon, iconBg, iconColor, label, value, sub, valueColor }: { href?: string; onClick?: () => void; icon: string; iconBg: string; iconColor: string; label: string; value: React.ReactNode; sub?: string; valueColor?: string }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-xl text-lg" style={{ background: iconBg, color: iconColor }}>{icon}</span>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="font-display text-3xl leading-tight" style={{ color: valueColor || "var(--text)" }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-muted)]">{sub}</p>}
    </>
  );
  const cls = "panel !p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

type PatientRow = {
  key: string;
  name: string;
  city: string;
  total: number;
  isCreated: boolean;
  lastSlot: string;
};

export default function PainelMedicoPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Omit<Doctor, "passwordHash"> | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [patientFilter, setPatientFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [quickKey, setQuickKey] = useState<string | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [returns, setReturns] = useState<ReturnsBuckets | null>(null);
  const [retTab, setRetTab] = useState<keyof ReturnsBuckets>("atrasados");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/doctor/patients").then((r) => r.json()),
    ]).then(([auth, books, pats]) => {
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      setDoctor(auth.doctor);
      setBookings(books.bookings || []);
      setPatients(pats.patients || []);
      setLoading(false);
    });
    // Painel premium: contagens reais e listas (retornos, novos exames, pendências, "continuar").
    fetch("/api/doctor/dashboard").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setDash(d); }).catch(() => {});
    fetch("/api/doctor/returns").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setReturns(d.buckets); }).catch(() => {});
  }, [router]);

  async function reloadBookings() {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  async function bookingAction(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, ...extra }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error || "Não foi possível concluir a ação.");
      return false;
    }
    await reloadBookings();
    return true;
  }

  async function proposeTime(b: Booking) {
    const date = window.prompt("Nova data (AAAA-MM-DD):");
    if (!date) return;
    const time = window.prompt("Novo horário (HH:MM):", "09:00");
    if (!time) return;
    const msg = window.prompt("Mensagem ao paciente (opcional):") || "";
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Data/horário inválidos.");
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await bookingAction(b.id, "propose", { slotStart: start.toISOString(), slotEnd: end.toISOString(), message: msg });
  }

  async function rescheduleConsulta(b: Booking) {
    const date = window.prompt("Remarcar — nova data (AAAA-MM-DD): (o pagamento é preservado, sem nova cobrança)");
    if (!date) return;
    const time = window.prompt("Novo horário (HH:MM):", "09:00");
    if (!time) return;
    const start = new Date(`${date}T${time}:00`);
    if (Number.isNaN(start.getTime())) return window.alert("Data/horário inválidos.");
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await bookingAction(b.id, "reschedule", { slotStart: start.toISOString(), slotEnd: end.toISOString() });
  }

  async function notRealized(b: Booking) {
    const reason = window.prompt("Motivo (médico indisponível / paciente indisponível / problema técnico / problema de conexão / remarcação / outro):", "remarcação");
    if (reason === null) return;
    await bookingAction(b.id, "not_realized", { reason });
  }

  function talkWhatsApp(b: Booking) {
    const digits = (b.patientPhone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `Olá, ${b.patientName}. Aqui é ${doctor?.name || "seu médico"}, do Meu Rim, sobre sua consulta de ${formatSlotLabel(b.slotStart)}.`;
    const url = withCountry ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function reloadPatients() {
    const res = await fetch("/api/doctor/patients");
    const data = await res.json();
    setPatients(data.patients || []);
    setShowCreate(false);
  }

  async function removeBooking(id: string) {
    if (!window.confirm("Excluir esta consulta? Esta ação não pode ser desfeita.")) return;
    const res = await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setBookings((bs) => bs.filter((b) => b.id !== id));
    else window.alert("Não foi possível excluir a consulta.");
  }

  async function removePatient(key: string, name: string) {
    if (!window.confirm(`Excluir o paciente ${name}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/doctor/patients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key }),
    });
    if (res.ok) setPatients((ps) => ps.filter((p) => p.key !== key));
    else window.alert("Não foi possível excluir o paciente.");
  }

  function remindWhatsApp(b: Booking) {
    const digits = (b.patientPhone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg =
      `Olá, ${b.patientName}! Lembrete da sua consulta no Meu Rim: ${formatSlotLabel(b.slotStart)}.` +
      (b.status === "pending_payment" ? " Confirme o pagamento para liberar o atendimento." : "");
    const url = withCountry
      ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading || !doctor) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">
        Carregando painel…
      </div>
    );
  }

  const todayStr = new Date().toDateString();
  const todaysBookings = bookings
    .filter((b) => new Date(b.slotStart).toDateString() === todayStr && b.status !== "cancelled")
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  const agendaHoje = todaysBookings.length;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-5 pb-28 pt-8 lg:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
            Olá, {(() => { const p = doctor.name.trim().split(/\s+/); return /^dr/i.test(p[0]) ? p.slice(0, 2).join(" ") : p[0]; })()} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Resumo da sua clínica hoje</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--text-soft)] sm:inline-flex">
            <span aria-hidden>📅</span> Hoje, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          <NotificationBell />
          <Link href="/medicos/mais" className="btn-ghost">Mais</Link>
        </div>
      </div>
      <div className="mt-4">
        <GlobalPatientSearch />
      </div>
      <EnableNotifications />

      {/* Cards de resumo do dia */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard href="/medicos/pacientes" icon="👥" iconBg="var(--gold-soft)" iconColor="var(--gold)" label="Pacientes" value={dash?.counts.pacientes ?? patients.length} sub="Todos ativos" />
        <MetricCard href="/medicos/agenda" icon="📅" iconBg="#e8f5ee" iconColor="#1a9a78" label="Consultas hoje" value={dash?.counts.consultasHoje ?? agendaHoje} sub={dash && dash.counts.aguardando > 0 ? `${dash.counts.aguardando} aguardando` : "no seu dia"} />
        <MetricCard href="/medicos/retornos" icon="↩" iconBg="#fff3e2" iconColor="#e08a2e" label="Retornos pendentes" value={dash?.counts.retornosPendentes ?? 0} valueColor={(dash?.counts.retornosPendentes ?? 0) > 0 ? "#e08a2e" : undefined} sub={dash && dash.counts.retornosAtrasados > 0 ? `${dash.counts.retornosAtrasados} atrasados` : "em dia"} />
        <MetricCard onClick={() => document.getElementById("alertas")?.scrollIntoView({ behavior: "smooth" })} icon="⚠" iconBg="#fdecea" iconColor="#e86761" label="Alertas clínicos" value={dash?.counts.alertas ?? 0} valueColor={(dash?.counts.alertas ?? 0) > 0 ? "#e86761" : undefined} sub="Atenção necessária" />
        <MetricCard onClick={() => document.getElementById("novos-exames")?.scrollIntoView({ behavior: "smooth" })} icon="🧪" iconBg="#e8f1fb" iconColor="#2b7fb0" label="Novos exames" value={dash?.counts.novosExames ?? 0} sub="Últimos 7 dias" />
        <MetricCard onClick={() => document.getElementById("pendencias")?.scrollIntoView({ behavior: "smooth" })} icon="🗂" iconBg="var(--gold-soft)" iconColor="var(--gold)" label="Pendências" value={dash?.counts.pendencias ?? 0} sub="Itens para resolver" />
      </div>

      {dash?.continuar && (
        <Link href={`/medicos/paciente/${encodeURIComponent(dash.continuar.patientKey)}`} className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-4 transition hover:border-[var(--gold)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--gold)]">↻</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">Continuar de onde parou</p>
              <p className="font-display text-lg text-[var(--text)]">{dash.continuar.patientName}</p>
              <p className="text-xs text-[var(--text-muted)]">Atendimento em andamento · iniciado {new Date(dash.continuar.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          <span className="btn-gold text-sm">Continuar atendimento →</span>
        </Link>
      )}

      {/* Bento premium: consultas | alertas+exames | retornos+pendências */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Coluna 1 — Consultas de hoje */}
        <section className="panel !p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[var(--text)]">Consultar de hoje</h2>
            <Link href="/medicos/agenda" className="text-sm font-semibold text-[var(--gold)]">Ver agenda completa</Link>
          </div>
          {todaysBookings.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhuma consulta agendada para hoje.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {todaysBookings.slice(0, 6).map((b) => {
                const st = consultaStatus(b);
                const time = new Date(b.slotStart).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setQuickKey(b.patientEmail)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--gold-soft)]">
                      <span className="font-display w-12 shrink-0 text-base text-[var(--text)]">{time}</span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-xs font-bold text-[var(--gold)]">{b.patientName.slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">{b.patientName}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">{[b.locationName || (b.modality === "teleconsulta" ? "Teleconsulta" : null), b.careReason === "acompanhamento" ? "Retorno" : "Primeira consulta"].filter(Boolean).join(" • ")}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: st.color, background: `${st.color}1a` }}>{st.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/medicos/agenda" className="btn-gold mt-4 block text-center">+ Nova consulta</Link>
        </section>

        {/* Coluna 2 — Alertas + Exames recentes */}
        <div className="flex flex-col gap-6">
          <section id="alertas" className="panel !p-5 scroll-mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-[var(--text)]">Alertas clínicos</h2>
              {dash && dash.counts.alertas > 0 && <span className="text-sm font-semibold text-[var(--gold)]">{dash.counts.alertas}</span>}
            </div>
            {(!dash || dash.alertas.length === 0) ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">✓ Nenhum alerta ativo.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dash.alertas.slice(0, 5).map((a, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setQuickKey(a.patientKey)} className="flex w-full items-center justify-between gap-2 rounded-xl border-l-4 bg-[var(--bg)] px-3 py-2 text-left transition hover:bg-[var(--gold-soft)]" style={{ borderColor: a.level === "urgente" ? "#e86761" : "#e08a2e" }}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">{a.patientName}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">{a.text}</span>
                      </span>
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: a.level === "urgente" ? "#e86761" : "#e08a2e", background: a.level === "urgente" ? "#fdecea" : "#fff3e2" }}>{a.level === "urgente" ? "Urgente" : "Importante"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="novos-exames" className="panel !p-5 scroll-mt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-[var(--text)]">Exames mais recentes</h2>
              <Link href="/medicos/pacientes" className="text-sm font-semibold text-[var(--gold)]">Ver todos</Link>
            </div>
            {(!dash || dash.recentExams.length === 0) ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Nenhum exame novo nos últimos 7 dias.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {dash.recentExams.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setQuickKey(e.patientKey)} className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--gold-soft)]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">{e.patientName}</span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">{e.testLabel} · {new Date(e.measuredAt).toLocaleDateString("pt-BR")}</span>
                      </span>
                      <span className="whitespace-nowrap rounded-full bg-[#e8f1fb] px-2 py-0.5 text-[11px] font-semibold text-[#2b7fb0]">Novo</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Coluna 3 — Retornos pendentes + Pendências */}
        <div className="flex flex-col gap-6">
          <section className="panel !p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-[var(--text)]">Retornos pendentes</h2>
              <Link href="/medicos/retornos" className="text-sm font-semibold text-[var(--gold)]">Ver todos</Link>
            </div>
            <div className="mt-3 -mx-1 flex gap-1 overflow-x-auto px-1">
              {([["atrasados", "Atrasados"], ["prox7", "Próx. 7"], ["prox30", "Próx. 30"], ["agendados", "Agendados"]] as [keyof ReturnsBuckets, string][]).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setRetTab(id)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition ${retTab === id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] text-[var(--text-soft)]"}`}>
                  {label}{returns ? <span className={retTab === id ? "text-white/80" : "text-[var(--text-muted)]"}> {returns[id].length}</span> : null}
                </button>
              ))}
            </div>
            {!returns ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : returns[retTab].length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">{retTab === "atrasados" ? "✓ Nenhum retorno atrasado." : "Nenhum retorno neste período."}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {returns[retTab].slice(0, 4).map((it) => (
                  <li key={it.id} className="rounded-xl border border-[var(--border)] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-xs font-bold text-[var(--gold)]">{it.patientName.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">{it.patientName}</p>
                        <p className="text-xs text-[var(--text-muted)]">Previsto: {fmtDay(it.dueAt)}{it.eff === "atrasado" ? ` · ${it.daysLate}d atrasado` : ""}{it.eff === "agendado" && it.nextConsultation ? ` · consulta ${fmtDay(it.nextConsultation)}` : ""}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Link href={`/medicos/paciente/${encodeURIComponent(it.patientKey)}`} className="rounded-lg bg-[var(--gold-soft)] px-2 py-1 text-xs font-semibold text-[var(--gold)]">Abrir</Link>
                      <Link href="/medicos/retornos" className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text-soft)]">Central</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="pendencias" className="panel !p-5 scroll-mt-4">
            <h2 className="font-display text-xl text-[var(--text)]">Pendências</h2>
            {(!dash || dash.pendencias.length === 0) ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">✓ Nada pendente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dash.pendencias.map((p, i) => (
                  <li key={i}>
                    <Link href={p.href} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 transition hover:border-[var(--border-gold)]">
                      <span className="text-sm text-[var(--text)]"><strong>{p.count}</strong> {p.label}</span>
                      <span className="text-[var(--gold)]">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Resumo da clínica + Ações rápidas */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="panel !p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[var(--text)]">Resumo da clínica</h2>
            <span className="text-xs text-[var(--text-muted)]">Últimos 7 dias</span>
          </div>
          {!dash ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {([
                ["Consultas realizadas", dash.resumo.consultasRealizadas, (v: number) => String(v)],
                ["Novos pacientes", dash.resumo.novosPacientes, (v: number) => String(v)],
                ["Retornos realizados", dash.resumo.retornosRealizados, (v: number) => String(v)],
                ["Exames importados", dash.resumo.examesImportados, (v: number) => String(v)],
                ["LME emitidas", dash.resumo.lmeEmitidas, (v: number) => String(v)],
                ["Receita líquida", dash.resumo.receitaCents, (v: number) => formatBRL(v)],
              ] as [string, Pair, (v: number) => string][]).map(([label, pair, fmt]) => (
                <div key={label}>
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="font-display text-2xl text-[var(--text)]">{fmt(pair.v)}</p>
                  <DeltaTag delta={pair.delta} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel !p-5">
          <h2 className="font-display text-xl text-[var(--text)]">Ações rápidas</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setShowCreate(true); document.getElementById("pacientes")?.scrollIntoView({ behavior: "smooth" }); }} className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] py-4 transition hover:border-[var(--border-gold)] hover:bg-[var(--gold-soft)]">
              <span className="text-xl">🧑‍⚕️</span><span className="text-xs font-semibold text-[var(--text-soft)]">Novo paciente</span>
            </button>
            <Link href="/medicos/pacientes" className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] py-4 transition hover:border-[var(--border-gold)] hover:bg-[var(--gold-soft)]">
              <span className="text-xl">🧪</span><span className="text-xs font-semibold text-[var(--text-soft)]">Novo exame</span>
            </Link>
            <Link href="/medicos/lme" className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] py-4 transition hover:border-[var(--border-gold)] hover:bg-[var(--gold-soft)]">
              <span className="text-xl">📄</span><span className="text-xs font-semibold text-[var(--text-soft)]">LME / CEAF</span>
            </Link>
            <Link href="/medicos/documentos" className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] py-4 transition hover:border-[var(--border-gold)] hover:bg-[var(--gold-soft)]">
              <span className="text-xl">℞</span><span className="text-xs font-semibold text-[var(--text-soft)]">Nova receita</span>
            </Link>
          </div>
        </section>
      </div>

      <section id="agenda" className="panel mt-8 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-[var(--text)]">Agenda e atendimento</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Dias de atendimento, valor da consulta, bio e WhatsApp ficam em Configurações.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/medicos/configuracoes#agenda" className="btn-ghost text-sm">Configurar agenda e valores</Link>
            <Link href="/medicos/agenda/configurar" className="btn-ghost text-sm">Clínicas e horários</Link>
          </div>
        </div>
      </section>

      <section id="pacientes" className="mt-8 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-[var(--text)]">Meus pacientes</h2>
          <button type="button" className="btn-gold" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Fechar" : "+ Criar paciente"}
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Crie o paciente e abra o prontuário para registrar evolução, emitir
          receitas, pedidos de exame e relatórios.
        </p>

        {showCreate && <CreatePatient onCreated={reloadPatients} />}

        <div className="mt-4">
          <input
            className="input-field"
            placeholder="Buscar paciente por nome ou cidade…"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
          />
        </div>

        <div className="mt-4 grid gap-3">
          {patients.length === 0 && (
            <p className="text-[var(--text-muted)]">Nenhum paciente ainda.</p>
          )}
          {patients
            .filter((p) => {
              const q = patientFilter.toLowerCase().trim();
              if (!q) return true;
              return `${p.name} ${p.city}`.toLowerCase().includes(q);
            })
            .map((p) => (
            <div
              key={p.key}
              className="panel flex items-center justify-between gap-2 transition hover:border-[var(--border-gold)]"
            >
              <Link
                href={`/medicos/paciente/${encodeURIComponent(p.key)}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-sm font-extrabold text-[var(--gold)]">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text)]">{p.name}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {[
                      p.city,
                      p.isCreated ? "Cadastrado por você" : `${p.total} consulta${p.total > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                {p.isCreated && (
                  <button
                    type="button"
                    onClick={() => removePatient(p.key, p.name)}
                    className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                    title="Excluir paciente"
                    aria-label={`Excluir paciente ${p.name}`}
                  >
                    <TrashIcon />
                  </button>
                )}
                <Link
                  href={`/medicos/paciente/${encodeURIComponent(p.key)}`}
                  className="grid h-9 w-9 place-items-center text-xl text-[var(--gold)]"
                  aria-label={`Abrir prontuário de ${p.name}`}
                >
                  ›
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="financeiro" className="mt-8 scroll-mt-4">
        <h2 className="font-display text-2xl text-[var(--text)]">Financeiro</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Você define o valor da sua consulta. O percentual de repasse é definido pela administração.
        </p>
        <FinanceCard />
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Recebimentos (Mercado Pago e Pix) ficam em{" "}
          <Link href="/medicos/configuracoes#recebimentos" className="font-semibold text-[var(--gold)]">Configurações › Recebimentos</Link>.
        </p>
      </section>

      {(() => {
        const pending = bookings.filter((b) => b.status === "paid" || b.stage === "proposto_novo_horario");
        if (pending.length === 0) return null;
        return (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-[var(--text)]">
              Consultas aguardando sua resposta
              <span className="ml-2 rounded-full bg-[var(--danger)] px-2 py-0.5 text-sm font-bold text-white align-middle">{pending.length}</span>
            </h2>
            <div className="mt-4 grid gap-3">
              {pending.map((b) => (
                <div key={b.id} className="panel border-[var(--border-gold)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[var(--text)]">{b.patientName}</p>
                      <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(b.slotStart)} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(b.priceCents / 100)}</p>
                      <p className="text-xs text-[var(--text-soft)]">
                        {b.patientPhone ? `WhatsApp: ${b.patientPhone} · ` : ""}Pagamento: pago · solicitada em {new Date(b.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                      {b.stage === "proposto_novo_horario" && (
                        <p className="mt-1 text-xs font-semibold text-amber-700">Você propôs {b.proposedSlotStart ? formatSlotLabel(b.proposedSlotStart) : "novo horário"} — aguardando resposta do paciente.</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.stage !== "proposto_novo_horario" && (
                      <button type="button" className="btn-gold" onClick={() => bookingAction(b.id, "confirm")}>Confirmar consulta</button>
                    )}
                    <button type="button" className="btn-ghost" onClick={() => proposeTime(b)}>Propor outro horário</button>
                    <button type="button" className="btn-ghost" onClick={() => talkWhatsApp(b)}>Falar com o paciente</button>
                    <button type="button" className="btn-ghost" onClick={() => { if (window.confirm("Recusar esta solicitação?")) bookingAction(b.id, "cancel"); }}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <section className="mt-8">
        <h2 className="font-display text-2xl text-[var(--text)]">Próximas consultas</h2>
        <div className="mt-4 grid gap-3">
          {bookings.length === 0 && (
            <p className="text-[var(--text-muted)]">Nenhuma consulta ainda.</p>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="panel flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--text)]">{b.patientName}</p>
                <p className="text-sm text-[var(--text-muted)]">{formatSlotLabel(b.slotStart)}</p>
                {(b.patientCity || b.careReason) && (
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {[b.patientCity, b.careReason === "pressa" ? "com pressa" : b.careReason === "segunda_opiniao" ? "2ª opinião" : b.careReason === "acompanhamento" ? "acompanhamento" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-xs uppercase tracking-wider text-[var(--gold-light)]">
                  {b.stage === "nao_realizada"
                    ? "Não realizada"
                    : b.status === "confirmed"
                      ? "Confirmada"
                      : b.status === "paid"
                        ? "Aguardando sua confirmação"
                        : b.status === "pending_payment"
                          ? "Aguardando pagamento"
                          : b.status === "cancelled"
                            ? "Cancelada"
                            : b.status}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {b.status === "confirmed" && (
                  <Link href={`/consulta/${b.meetingRoomId}`} className="btn-gold">
                    Entrar na sala
                  </Link>
                )}
                {b.status === "confirmed" && (
                  <>
                    <button type="button" className="btn-ghost" onClick={() => rescheduleConsulta(b)}>Remarcar (sem nova cobrança)</button>
                    <button type="button" className="btn-ghost" onClick={() => notRealized(b)}>Não realizada</button>
                  </>
                )}
                {b.stage === "nao_realizada" && (
                  <button type="button" className="btn-gold" onClick={() => rescheduleConsulta(b)}>Remarcar sem nova cobrança</button>
                )}
                <button
                  type="button"
                  onClick={() => remindWhatsApp(b)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-white px-3 py-2 text-sm font-semibold text-[var(--gold)] transition hover:border-[var(--gold)]"
                  aria-label={`Lembrar ${b.patientName} no WhatsApp`}
                >
                  Lembrar no WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => removeBooking(b.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  aria-label={`Excluir consulta de ${b.patientName}`}
                >
                  <TrashIcon /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
        </div>
      </div>
      <DoctorMobileNav />
      {quickKey && <PatientQuickSheet patientKey={quickKey} onClose={() => setQuickKey(null)} />}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function FinanceCard() {
  const [data, setData] = useState<{
    consultationPriceCents: number;
    commissionPercent: number;
    platformPercent: number;
    payoutStatus: "active" | "pending" | "blocked";
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/doctor/finance")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.consultationPriceCents === "number") {
          setData(d);
          setPrice(String(d.consultationPriceCents / 100));
        }
      })
      .catch(() => {});
  };
  useEffect(load, []);

  async function savePrice() {
    setSaving(true);
    setMsg("");
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultationPriceCents: cents }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      setMsg("Valor da consulta salvo.");
      load();
    } else {
      setMsg("Não foi possível salvar o valor.");
    }
  }

  if (!data) return <div className="panel mt-4 text-[var(--text-muted)]">Carregando…</div>;

  const payoutLabel: Record<string, string> = {
    active: "Ativo",
    pending: "Pendente",
    blocked: "Bloqueado",
  };

  return (
    <div className="panel mt-4 grid gap-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Valor da consulta
        </p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[var(--text-muted)]">R$</span>
            <input
              type="number"
              min={0}
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-[var(--text)] outline-none focus:border-[var(--teal,#0d9488)]"
            />
            <button type="button" onClick={savePrice} disabled={saving} className="btn-gold px-3 py-1.5 text-sm disabled:opacity-50">
              {saving ? "…" : "Salvar valor"}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-bold text-[var(--text)]">
              {formatBRL(data.consultationPriceCents)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-soft)] transition hover:border-[var(--teal,#0d9488)]"
            >
              Editar
            </button>
          </div>
        )}
        {msg && <p className="mt-1 text-xs text-[var(--teal,#0d9488)]">{msg}</p>}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Repasse contratado
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text)]">{data.commissionPercent}%</p>
        <p className="text-xs text-[var(--text-muted)]">
          Plataforma: {data.platformPercent}% · definido pela administração
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Recebimento
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            data.payoutStatus === "active" ? "text-[var(--teal,#0d9488)]" : "text-[var(--danger)]"
          }`}
        >
          {payoutLabel[data.payoutStatus] ?? data.payoutStatus}
        </p>
        {data.payoutStatus !== "active" && (
          <p className="text-xs text-[var(--text-muted)]">Fale com a administração para liberar.</p>
        )}
      </div>
    </div>
  );
}

function CreatePatient({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    cns: "",
    motherName: "",
    birthdate: "",
    sex: "",
    phone: "",
    email: "",
    address: "",
    emergencyContact: "",
    guardianName: "",
    guardianPhone: "",
    insurance: "",
    allergies: "",
    diseases: "",
    medications: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; phone: string; email: string; cpf: string } | null>(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [dup, setDup] = useState<{ id: string; name: string; cpf?: string | null } | null>(null);
  function copyText(text: string, label: string) { navigator.clipboard?.writeText(text); setCopyMsg(`${label} copiado!`); setTimeout(() => setCopyMsg(""), 1500); }

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit(force = false) {
    if (!form.name.trim()) { setError("Informe o nome completo."); return; }
    if (!form.birthdate) { setError("Informe a data de nascimento (necessária para calcular idade e TFGe)."); return; }
    if (!form.sex) { setError("Selecione o sexo (feminino ou masculino)."); return; }
    if (!form.address.trim()) { setError("Informe a cidade / região."); return; }
    setSaving(true);
    setError("");
    if (force) setDup(null);
    try {
      const res = await fetch("/api/doctor/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, force }),
      });
      const data = await res.json();
      if (data.possibleDuplicate) {
        setDup(data.existing);
        setSaving(false);
        return;
      }
      if (res.status === 409) {
        throw new Error(
          data.existingIsMine
            ? "Você já tem um paciente com este CPF."
            : "Já existe um paciente com este CPF em outro médico. Solicite vínculo."
        );
      }
      if (!res.ok) throw new Error(data.error || "Não foi possível criar.");
      setDone({ name: form.name, phone: form.phone, email: form.email, cpf: form.cpf });
      if (data.linkedExisting) {
        setError(""); // sucesso: conta do paciente vinculada ao prontuário deste médico
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  function accessMessage() {
    return patientAccessMessage(done!.name);
  }
  function inviteLink() {
    const digits = done!.phone.replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(accessMessage())}`;
  }

  if (done) {
    const hasPhone = done.phone.replace(/\D/g, "").length >= 10;
    return (
      <div className="panel mt-4 space-y-3">
        <p className="text-sm font-semibold text-[var(--green)]">Paciente cadastrado ✅</p>
        {done.cpf.replace(/\D/g, "") ? (
          <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)] p-3 text-sm text-[var(--text-soft)]">
            <p className="font-semibold text-[var(--text)]">Acesso do paciente</p>
            <p>Site: <b>{SITE_URL}/</b></p>
            <p>Login (CPF): <b>{done.cpf.replace(/\D/g, "")}</b></p>
            <p>Senha provisória: <b>123456</b> — no 1º acesso o paciente cria uma senha pessoal.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text-muted)]">
            Sem CPF cadastrado: informe o CPF para habilitar o login do paciente com senha.
          </p>
        )}

        {/* Mensagem pronta de primeiro acesso */}
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Mensagem de acesso</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-[var(--text-soft)]">{accessMessage()}</pre>
        </div>

        {!hasPhone && (
          <p className="rounded-xl border border-[var(--warn)]/30 bg-[#fff7e8] px-3 py-2 text-xs text-[#7a5a12]">
            Sem telefone com WhatsApp — não é possível enviar automaticamente. Use “Copiar mensagem” e envie ao paciente.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {hasPhone && (
            <>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-gold">Enviar acesso pelo WhatsApp</a>
              <a href={inviteLink()} target="_blank" rel="noopener noreferrer" className="btn-ghost">Reenviar acesso</a>
            </>
          )}
          <button type="button" className="btn-ghost" onClick={() => copyText(accessMessage(), "Mensagem")}>Copiar mensagem</button>
          <button type="button" className="btn-ghost" onClick={() => copyText(`${SITE_URL}/`, "Link")}>Copiar link</button>
        </div>
        {copyMsg && <p className="text-xs font-semibold text-[var(--green,#0d9488)]">{copyMsg}</p>}

        {/* QR Code permanente — somente a URL oficial */}
        <div className="pt-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">QR Code de acesso</p>
          <p className="mb-2 text-xs text-[var(--text-muted)]">Aponte a câmera para {SITE_URL}/ — sem dados pessoais.</p>
          <QrCode value={`${SITE_URL}/`} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={() => { setDone(null); setForm((f) => ({ ...f, name: "", cpf: "", phone: "", email: "" })); }}>Cadastrar outro</button>
          <button type="button" className="btn-ghost" onClick={onCreated}>Concluir</button>
        </div>
      </div>
    );
  }

  const fields = [
    ["name", "Nome completo", "text", true],
    ["cpf", "CPF", "text", false],
    ["birthdate", "Data de nascimento", "date", true],
    ["sex", "Sexo", "select", true],
    ["address", "Cidade / região", "text", true],
    ["cns", "CNS (Cartão SUS)", "text", false],
    ["motherName", "Nome da mãe", "text", false],
    ["phone", "Telefone", "tel", false],
    ["email", "E-mail", "email", false],
    ["emergencyContact", "Contato de emergência", "text", false],
    ["guardianName", "Responsável legal (se menor)", "text", false],
    ["guardianPhone", "Telefone do responsável", "tel", false],
    ["insurance", "Convênio / particular", "text", false],
  ] as const;

  const longFields = [
    ["allergies", "Alergias"],
    ["diseases", "Doenças"],
    ["medications", "Medicamentos em uso"],
    ["notes", "Observações"],
  ] as const;

  return (
    <div className="panel mt-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Novo paciente</p>
      <p className="text-xs text-[var(--text-muted)]">Campos com <span className="text-[var(--danger)]">*</span> são obrigatórios (idade, sexo e cidade são necessários para cálculos e pesquisa).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label, type, required]) => (
          <label key={k} className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}{required ? <span className="text-[var(--danger)]"> *</span> : null}</span>
            {type === "select" ? (
              <select className="input-field" value={form[k]} onChange={(e) => set(k, e.target.value)}>
                <option value="">Selecione</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
              </select>
            ) : (
              <input type={type} className="input-field" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            )}
          </label>
        ))}
      </div>
      {longFields.map(([k, label]) => (
        <label key={k} className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
          <textarea className="input-field min-h-[60px]" value={form[k]} onChange={(e) => set(k, e.target.value)} />
        </label>
      ))}
      {dup && (
        <div className="rounded-xl border border-[var(--warn)]/40 bg-[#fff7e8] p-3 text-sm text-[#7a5a12]">
          <p className="font-semibold">Já existe um paciente com nome parecido: {dup.name}{dup.cpf ? ` (CPF ${dup.cpf})` : ""}.</p>
          <p className="mt-1">É a mesma pessoa? Abra o cadastro existente. Se for outra pessoa, crie mesmo assim.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/medicos/paciente/${encodeURIComponent(dup.id)}`} className="btn-ghost text-sm">Abrir existente</Link>
            <button type="button" className="btn-gold text-sm" onClick={() => submit(true)} disabled={saving}>Criar mesmo assim</button>
            <button type="button" className="btn-ghost text-sm" onClick={() => setDup(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="button" className="btn-gold" onClick={() => submit(false)} disabled={saving || !form.name.trim()}>
        {saving ? "Criando…" : "Criar paciente e abrir prontuário"}
      </button>
    </div>
  );
}
