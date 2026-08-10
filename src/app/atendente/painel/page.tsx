"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Perms = Record<string, boolean>;
type DoctorLink = { doctorId: string; doctorName: string; specialty: string; permissions: Perms };
type Booking = {
  id: string; patientName: string; patientPhone: string; patientEmail: string;
  slotStart: string; slotEnd: string; status: string; stage: string | null;
  modality: string | null; locationName: string | null; meetingRoomId: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Aguardando pagamento", cls: "bg-slate-100 text-slate-600" },
  paid: { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada", cls: "bg-red-100 text-red-600" },
  completed: { label: "Realizada", cls: "bg-slate-100 text-slate-600" },
};

function waLink(phone: string, text: string) {
  const n = (phone || "").replace(/\D/g, "").replace(/^(?!55)/, "55");
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export default function AtendentePainelPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [doctors, setDoctors] = useState<DoctorLink[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const perms = doctors.find((d) => d.doctorId === doctorId)?.permissions || {};

  const loadAgenda = useCallback(async (did: string) => {
    const r = await fetch(`/api/atendente/agenda?doctorId=${did}`).then((x) => x.json());
    setBookings(r.bookings || []);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/atendente/me").then((r) => r.json());
      if (!me.attendant) { router.replace("/atendente/login"); return; }
      setName(me.attendant.name);
      setDoctors(me.doctors || []);
      const first = me.doctors?.[0]?.doctorId || "";
      setDoctorId(first);
      if (first) await loadAgenda(first);
      setLoading(false);
    })();
  }, [router, loadAgenda]);

  useEffect(() => { if (doctorId) loadAgenda(doctorId); }, [doctorId, loadAgenda]);

  async function logout() { await fetch("/api/atendente/session", { method: "DELETE" }); router.replace("/atendente/login"); }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/atendente/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctorId, id, action, ...extra }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || "Não foi possível."); return; }
    loadAgenda(doctorId);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todays = bookings.filter((b) => b.slotStart.slice(0, 10) === today && b.status !== "cancelled");
  const upcoming = bookings.filter((b) => b.slotStart > new Date().toISOString() && b.status !== "cancelled");

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--gold)]">Painel da atendente</p>
          <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">Olá, {name}</h1>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={logout}>Sair</button>
      </div>

      {doctors.length > 1 && (
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Médico</span>
          <select className="input-field" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>)}
          </select>
        </label>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/atendente/agendar?doctorId=${doctorId}`} className="btn-gold">+ Novo agendamento</Link>
      </div>

      <Section title={`Agenda de hoje (${todays.length})`}>
        {todays.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sem consultas para hoje.</p>}
        {todays.map((b) => <Row key={b.id} b={b} perms={perms} onAct={act} />)}
      </Section>

      <Section title={`Próximas consultas (${upcoming.length})`}>
        {upcoming.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhuma consulta futura.</p>}
        {upcoming.slice(0, 20).map((b) => <Row key={b.id} b={b} perms={perms} onAct={act} />)}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">{title}</h2>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

function Row({ b, perms, onAct }: { b: Booking; perms: Perms; onAct: (id: string, a: string, e?: Record<string, unknown>) => void }) {
  const dt = new Date(b.slotStart).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const st = STATUS[b.status] || { label: b.status, cls: "bg-slate-100 text-slate-600" };
  function reschedule() {
    const v = window.prompt("Novo horário (AAAA-MM-DD HH:MM):");
    if (!v) return;
    const d = new Date(v.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) { window.alert("Data inválida."); return; }
    const end = new Date(d.getTime() + 30 * 60000);
    onAct(b.id, "reschedule", { slotStart: d.toISOString(), slotEnd: end.toISOString() });
  }
  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text)]">{b.patientName}</p>
          <p className="text-sm text-[var(--text-muted)]">{dt} · {b.modality === "teleconsulta" ? "Teleconsulta" : b.locationName || "Presencial"}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {perms.confirmar && b.status !== "confirmed" && b.status !== "cancelled" && <button type="button" className="btn-ghost text-sm" onClick={() => onAct(b.id, "confirm")}>Confirmar</button>}
        {perms.remarcar && b.status !== "cancelled" && <button type="button" className="btn-ghost text-sm" onClick={reschedule}>Remarcar</button>}
        {perms.cancelar && b.status !== "cancelled" && <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => onAct(b.id, "cancel")}>Cancelar</button>}
        {perms.ausencia && b.status === "confirmed" && <button type="button" className="btn-ghost text-sm" onClick={() => onAct(b.id, "not_realized")}>Não compareceu</button>}
        {perms.whatsapp && b.patientPhone && <a className="btn-ghost text-sm" target="_blank" rel="noopener noreferrer" href={waLink(b.patientPhone, `Olá ${b.patientName.split(" ")[0]}, sobre sua consulta em ${dt}.`)}>WhatsApp</a>}
      </div>
    </div>
  );
}
