"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { disablePush, enablePush, isSubscribed, notificationPermission, pushSupported } from "@/lib/push-client";
import { DoctorPaymentSettings } from "@/components/DoctorPaymentSettings";
import { DoctorPixSettings } from "@/components/DoctorPixSettings";

type Prefs = {
  notifyPush: boolean;
  notifyReminder24: boolean;
  notifyReminder2: boolean;
  notifyNewBookings: boolean;
  notifyReschedules: boolean;
  notifyPayments: boolean;
  calendarEventMode: "meurim" | "patient";
};

const DEFAULT: Prefs = {
  notifyPush: true,
  notifyReminder24: true,
  notifyReminder2: true,
  notifyNewBookings: true,
  notifyReschedules: true,
  notifyPayments: true,
  calendarEventMode: "meurim",
};

export default function ConfiguracoesMedicoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [subscribed, setSubscribed] = useState(false);
  const [supported, setSupported] = useState(true);
  const [msg, setMsg] = useState("");
  const [pushMsg, setPushMsg] = useState("");
  const [cns, setCns] = useState("");

  useEffect(() => {
    (async () => {
      const auth = await fetch("/api/auth").then((r) => r.json());
      if (!auth.doctor) {
        router.replace("/medicos/login");
        return;
      }
      const d = auth.doctor;
      setPrefs({
        notifyPush: d.notifyPush !== false,
        notifyReminder24: d.notifyReminder24 !== false,
        notifyReminder2: d.notifyReminder2 !== false,
        notifyNewBookings: d.notifyNewBookings !== false,
        notifyReschedules: d.notifyReschedules !== false,
        notifyPayments: d.notifyPayments !== false,
        calendarEventMode: d.calendarEventMode === "patient" ? "patient" : "meurim",
      });
      setCns(d.cns || "");
      setSupported(pushSupported());
      setSubscribed(await isSubscribed());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...prefs, cns }),
    });
    setMsg(res.ok ? "Preferências salvas." : "Não foi possível salvar agora.");
  }

  async function ativarPush() {
    setPushMsg("");
    const r = await enablePush();
    if (r.ok) {
      setSubscribed(true);
      setPushMsg("Notificações ativadas neste aparelho.");
    } else if (r.reason === "denied") {
      setPushMsg("Permissão negada. Ative nas configurações do navegador.");
    } else if (r.reason === "not_configured") {
      setPushMsg("As notificações ainda não foram configuradas no servidor (VAPID).");
    } else {
      setPushMsg("Não foi possível ativar agora.");
    }
  }
  async function desativarPush() {
    await disablePush();
    setSubscribed(false);
    setPushMsg("Notificações desativadas neste aparelho.");
  }

  if (loading) return <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  const perm = notificationPermission();

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
          <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Configurações</h1>
          <p className="mt-1 text-[var(--text-muted)]">Notificações no celular, lembretes, calendário, documentos e dados SUS/CEAF.</p>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Dados SUS / CEAF</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastre uma vez — reutilizado automaticamente em toda LME/CEAF.</p>
            <label className="mt-3 block max-w-sm">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CNS do médico (Cartão Nacional de Saúde)</span>
              <input className="input-field" value={cns} onChange={(e) => setCns(e.target.value)} inputMode="numeric" placeholder="000 0000 0000 0000" />
            </label>
          </section>

          <section id="recebimentos" className="mt-6 scroll-mt-4">
            <h2 className="font-display text-xl text-[var(--text)]">Recebimentos</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Como você recebe o valor das consultas: conta Mercado Pago e/ou chave Pix própria.</p>
            <p className="mt-3 text-sm font-semibold text-[var(--text)]">Mercado Pago</p>
            <DoctorPaymentSettings />
            <p className="mt-5 text-sm font-semibold text-[var(--text)]">Pix (recebimento direto)</p>
            <DoctorPixSettings />
          </section>

          <Link href="/medicos/configuracoes/documentos" className="panel mt-6 flex items-center justify-between transition hover:border-[var(--border-gold)]">
            <div>
              <h2 className="font-display text-xl text-[var(--text)]">Meus papéis timbrados</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Envie seu receituário (PDF/PNG/JPG) e configure onde o sistema escreve. Usado em receitas, relatórios, atestados e documentos livres.</p>
            </div>
            <span className="text-2xl text-[var(--gold)]">→</span>
          </Link>

          <Link href="/medicos/assinatura" className="panel mt-4 flex items-center justify-between transition hover:border-[var(--border-gold)]">
            <div>
              <h2 className="font-display text-xl text-[var(--text)]">Minha assinatura digital</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Assinatura visual e integração ICP-Brasil (quando o provedor estiver configurado). Assinatura digital e manual dos documentos.</p>
            </div>
            <span className="text-2xl text-[var(--gold)]">→</span>
          </Link>

          <Link href="/medicos/equipe" className="panel mt-4 flex items-center justify-between transition hover:border-[var(--border-gold)]">
            <div>
              <h2 className="font-display text-xl text-[var(--text)]">Minha equipe — Atendentes</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastre atendentes (CPF e/ou e-mail) com login próprio e permissões administrativas. Elas agendam, remarcam e confirmam — sem acesso clínico.</p>
            </div>
            <span className="text-2xl text-[var(--gold)]">→</span>
          </Link>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Notificações neste aparelho</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Instale o Meu Rim na tela inicial e ative para receber avisos de consultas mesmo com o app fechado.
            </p>
            {!supported && (
              <p className="mt-3 rounded-xl bg-[var(--bg-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
                Este navegador não suporta notificações push. No iPhone, adicione o app à Tela de Início e abra por lá.
              </p>
            )}
            {supported && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {subscribed ? (
                  <button type="button" className="btn-ghost" onClick={desativarPush}>Desativar neste aparelho</button>
                ) : (
                  <button type="button" className="btn-gold" onClick={ativarPush}>Ativar notificações</button>
                )}
                <span className="text-xs text-[var(--text-muted)]">
                  {perm === "granted" ? "Permissão concedida" : perm === "denied" ? "Permissão bloqueada no navegador" : "Permissão ainda não solicitada"}
                </span>
              </div>
            )}
            {pushMsg && <p className="mt-2 text-sm font-semibold text-[var(--gold)]">{pushMsg}</p>}
          </section>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">O que você quer receber</h2>
            <div className="mt-3 grid gap-2">
              <Toggle label="Ativar notificações push" checked={prefs.notifyPush} onChange={(v) => set("notifyPush", v)} />
              <Toggle label="Novas consultas" checked={prefs.notifyNewBookings} onChange={(v) => set("notifyNewBookings", v)} />
              <Toggle label="Alterações de horário / remarcações" checked={prefs.notifyReschedules} onChange={(v) => set("notifyReschedules", v)} />
              <Toggle label="Pagamentos" checked={prefs.notifyPayments} onChange={(v) => set("notifyPayments", v)} />
              <Toggle label="Lembrete 24 horas antes" checked={prefs.notifyReminder24} onChange={(v) => set("notifyReminder24", v)} />
              <Toggle label="Lembrete 2 horas antes" checked={prefs.notifyReminder2} onChange={(v) => set("notifyReminder2", v)} />
            </div>
          </section>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Calendário</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Como o título da consulta aparece quando você adiciona ao seu calendário.</p>
            <div className="mt-3 grid gap-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="cal" checked={prefs.calendarEventMode === "meurim"} onChange={() => set("calendarEventMode", "meurim")} />
                <span className="text-sm text-[var(--text)]">“Consulta — Meu Rim” <span className="text-[var(--text-muted)]">(não expõe o nome do paciente)</span></span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="cal" checked={prefs.calendarEventMode === "patient"} onChange={() => set("calendarEventMode", "patient")} />
                <span className="text-sm text-[var(--text)]">“Consulta — Nome do paciente”</span>
              </label>
            </div>
          </section>

          {msg && <p className="mt-4 text-sm font-semibold text-[var(--gold)]">{msg}</p>}
          <button type="button" className="btn-gold mt-4" onClick={save}>Salvar preferências</button>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
      <span className="text-sm text-[var(--text)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
    </label>
  );
}
