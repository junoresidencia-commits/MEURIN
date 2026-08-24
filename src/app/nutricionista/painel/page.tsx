"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { nutritionist: { name: string; crn?: string | null; uf?: string | null; specialty?: string | null; photoUrl?: string | null }; doctors: { id: string; name: string }[] };
type Patient = { key: string; name: string; cpf: string | null; doctorId: string };
type Referral = { id: string; patientKey: string; patientName?: string | null; reason?: string | null; objective?: string | null; priority: string; status: string; doctorName?: string | null; createdAt: string };

export default function NutricionistaPainelPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const meRes = await fetch("/api/nutricionista/me");
    if (meRes.status === 401) { router.replace("/nutricionista/login"); return; }
    const meData = await meRes.json();
    setMe(meData);
    const pRes = await fetch("/api/nutricionista/patients");
    const pData = await pRes.json();
    setPatients(pData.patients || []);
    setReferrals(pData.referrals || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/nutricionista/session", { method: "DELETE" });
    router.push("/nutricionista/login");
  }

  const openReferrals = referrals.filter((r) => r.status === "aberto");
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.cpf || "").includes(q)) : patients;

  if (loading) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {me?.nutritionist.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.nutritionist.photoUrl} alt="Sua foto" className="h-14 w-14 shrink-0 rounded-full border border-[var(--border)] object-cover" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-lg font-bold text-[var(--gold)]">{(me?.nutritionist.name || "Nu").slice(0, 2).toUpperCase()}</span>
          )}
          <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Nutrição Renal</p>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Olá, {me?.nutritionist.name?.split(" ")[0]} 🥗</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {me?.nutritionist.crn ? `CRN ${me.nutritionist.crn}${me.nutritionist.uf ? "-" + me.nutritionist.uf : ""} · ` : ""}
            Vinculada a {me?.doctors.length || 0} médico(s): {me?.doctors.map((d) => d.name).join(", ") || "—"}
          </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/nutricionista/configuracoes" className="btn-ghost">Perfil e recebimentos</Link>
          <button type="button" className="btn-ghost" onClick={logout}>Sair</button>
        </div>
      </div>

      <NutriAppointments />

      {/* Encaminhamentos abertos */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Encaminhamentos</h2>
        {openReferrals.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum encaminhamento em aberto.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {openReferrals.map((r) => (
              <Link key={r.id} href={`/nutricionista/paciente/${encodeURIComponent(r.patientKey)}?ref=${r.id}`} className="panel flex flex-wrap items-center justify-between gap-2 transition hover:border-[var(--border-gold)]">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {r.patientName || "Paciente"}
                    {r.priority === "alta" && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Prioridade alta</span>}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">{r.reason || "Encaminhamento nutricional"}{r.objective ? ` — ${r.objective}` : ""}</p>
                  <p className="text-xs text-[var(--text-muted)]">Encaminhado por {r.doctorName || "médico"}</p>
                </div>
                <span className="text-[var(--gold)]">Abrir →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pacientes */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-[var(--text)]">Pacientes</h2>
        <input className="input-field mt-3" placeholder="Buscar por nome ou CPF" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-3 grid gap-2">
          {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nenhum paciente encontrado.</p>}
          {filtered.map((p) => (
            <Link key={p.key} href={`/nutricionista/paciente/${encodeURIComponent(p.key)}`} className="panel flex items-center justify-between transition hover:border-[var(--border-gold)]">
              <div>
                <p className="font-semibold text-[var(--text)]">{p.name}</p>
                {p.cpf && <p className="text-xs text-[var(--text-muted)]">CPF {p.cpf}</p>}
              </div>
              <span className="text-[var(--gold)]">Abrir →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

type Appt = { id: string; patientName?: string | null; slotStart?: string | null; priceCents: number; status: string; proofUrl?: string | null; nutritionistPayoutCents?: number | null; platformFeeCents?: number | null; commissionPercent?: number | null };
const APPT_STATUS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento", aguardando_confirmacao: "Comprovante enviado", confirmada: "Confirmada", cancelada: "Cancelada", realizada: "Realizada",
};

function NutriAppointments() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [open, setOpen] = useState(false);
  async function load() { const d = await fetch("/api/nutricionista/appointments").then((r) => r.json()); setAppts(d.appointments || []); }
  useEffect(() => { load(); }, []);
  async function setStatus(id: string, status: string) {
    await fetch("/api/nutricionista/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    await load();
  }
  const pending = appts.filter((a) => a.status === "aguardando_confirmacao" || a.status === "aguardando_pagamento");
  if (appts.length === 0) return null;
  return (
    <section className="panel mt-6">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="font-display text-xl text-[var(--text)]">Consultas e comprovantes {pending.length > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{pending.length}</span>}</span>
        <span className="text-[var(--gold)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Ao confirmar o recebimento, o plano alimentar é liberado na área do paciente.</p>
        <div className="mt-3 grid gap-2">
          {appts.map((a) => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--text)]">{a.patientName || "Paciente"} <span className="text-sm font-normal text-[var(--text-muted)]">· R$ {(a.priceCents / 100).toFixed(2)}</span></p>
                  <p className="text-xs text-[var(--text-muted)]">{a.slotStart ? new Date(a.slotStart).toLocaleString("pt-BR") : "sem horário"} · repasse R$ {((a.nutritionistPayoutCents ?? a.priceCents) / 100).toFixed(2)} (comissão {a.commissionPercent ?? 0}%)</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "confirmada" || a.status === "realizada" ? "bg-emerald-100 text-emerald-700" : a.status === "cancelada" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{APPT_STATUS[a.status] || a.status}</span>
              </div>
              {a.proofUrl && (
                <a href={a.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-[var(--gold)]">Ver comprovante ↗</a>
              )}
              {(a.status === "aguardando_confirmacao" || a.status === "aguardando_pagamento") && (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-gold text-sm" onClick={() => setStatus(a.id, "confirmada")}>Confirmar recebimento</button>
                  <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => setStatus(a.id, "cancelada")}>Cancelar</button>
                </div>
              )}
              {a.status === "confirmada" && <button type="button" className="btn-ghost mt-2 text-sm" onClick={() => setStatus(a.id, "realizada")}>Marcar como realizada</button>}
            </div>
          ))}
        </div>
        </>
      )}
    </section>
  );
}
