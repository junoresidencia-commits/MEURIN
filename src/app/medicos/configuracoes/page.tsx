"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { disablePush, enablePush, isSubscribed, notificationPermission, pushSupported } from "@/lib/push-client";
import { DoctorPaymentSettings } from "@/components/DoctorPaymentSettings";
import { DoctorPixSettings } from "@/components/DoctorPixSettings";
import { LogoUploader } from "@/components/LogoUploader";
import type { WeeklySlot } from "@/lib/types";

const DAYS = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

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
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [rqe, setRqe] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [weekly, setWeekly] = useState<WeeklySlot[]>([]);
  const [price, setPrice] = useState("350");
  const [bio, setBio] = useState("");
  const [notifyWa, setNotifyWa] = useState("");
  const [patientWa, setPatientWa] = useState("");
  const [allowPatientWa, setAllowPatientWa] = useState(false);

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
      setName(d.name || "");
      setCpf(d.cpf || "");
      setSpecialty(d.specialty || "");
      setRqe(d.rqe || "");
      setSignatureUrl(d.signatureUrl || "");
      setWeekly(d.weeklyAvailability || []);
      setPrice(String((d.consultationPriceCents ?? 35000) / 100));
      setBio(d.bio || "");
      setNotifyWa(d.notifyWhatsapp || "");
      setPatientWa(d.patientContactWhatsapp || "");
      setAllowPatientWa(Boolean(d.allowPatientContact));
      setSupported(pushSupported());
      setSubscribed(await isSubscribed());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  function toggleDay(dayOfWeek: number) {
    setWeekly((w) =>
      w.some((x) => x.dayOfWeek === dayOfWeek)
        ? w.filter((x) => x.dayOfWeek !== dayOfWeek)
        : [...w, { dayOfWeek, start: "08:00", end: "12:00" }, { dayOfWeek, start: "14:00", end: "18:00" }]
    );
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prefs,
        cns,
        name,
        cpf,
        specialty,
        rqe,
        signatureUrl,
        weeklyAvailability: weekly,
        consultationPriceCents: Math.round(Number(String(price).replace(",", ".")) * 100),
        bio,
        notifyWhatsapp: notifyWa,
        patientContactWhatsapp: patientWa,
        allowPatientContact: allowPatientWa,
      }),
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

          <section id="agenda" className="panel mt-6 scroll-mt-4">
            <h2 className="font-display text-xl text-[var(--text)]">Agenda e atendimento</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Dias em que você atende (os pacientes só veem esses horários), valor da consulta e bio pública.</p>
            <p className="mt-2 rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
              Precisa de <strong>clínicas diferentes por dia</strong> ou teleconsulta?{" "}
              <Link href="/medicos/agenda/configurar" className="font-semibold text-[var(--gold)] underline">Abrir a Agenda por local/horário</Link>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = weekly.some((w) => w.dayOfWeek === d.id);
                return (
                  <button key={d.id} type="button" onClick={() => toggleDay(d.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${on ? "bg-[var(--gold)] text-white" : "border border-[var(--border)]"}`}>
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Valor da consulta (R$)</span>
                <input type="number" className="input-field" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Bio pública</span>
              <textarea className="input-field min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft,#f8fafc)] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">WhatsApp e comunicação</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">O número de <strong>notificações é só seu</strong> — nunca é mostrado ao paciente.</p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Número para receber notificações (privado)</span>
                <input className="input-field" inputMode="tel" value={notifyWa} onChange={(e) => setNotifyWa(e.target.value)} placeholder="Seu WhatsApp pessoal/profissional" />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Número para contato dos pacientes (pode ser secretária/clínica)</span>
                <input className="input-field" inputMode="tel" value={patientWa} onChange={(e) => setPatientWa(e.target.value)} placeholder="Número que o paciente pode usar" />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-soft)]">
                <input type="checkbox" checked={allowPatientWa} onChange={(e) => setAllowPatientWa(e.target.checked)} />
                Permitir que pacientes falem sobre a consulta pelo WhatsApp
              </label>
            </div>
          </section>

          <section className="panel mt-6">
            <h2 className="font-display text-xl text-[var(--text)]">Meus dados (documentos, LME e receitas)</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">O nome completo aparece nas receitas, LME e relatórios. CPF e CNS são reutilizados automaticamente na LME/CEAF.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Nome completo</span>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Juno Damacena Barbosa" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Especialidade</span>
                <input className="input-field" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex.: Nefrologista" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">RQE (opcional)</span>
                <input className="input-field" value={rqe} onChange={(e) => setRqe(e.target.value)} inputMode="numeric" placeholder="Ex.: 25129" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CPF do médico</span>
                <input className="input-field" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">CNS (Cartão Nacional de Saúde)</span>
                <input className="input-field" value={cns} onChange={(e) => setCns(e.target.value)} inputMode="numeric" placeholder="000 0000 0000 0000" />
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Nome, especialidade e RQE aparecem nas receitas, relatórios e na LME.</p>
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-semibold text-[var(--text)]">Minha assinatura</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Envie uma imagem da sua assinatura (PNG com fundo transparente fica melhor). Ela aparece na LME oficial
                e nos documentos. Se preferir assinar à mão, deixe em branco e assine o papel impresso.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureUrl} alt="Assinatura" className="h-16 max-w-[220px] rounded-lg border border-[var(--border)] bg-white object-contain p-1" />
                ) : (
                  <span className="grid h-16 w-[220px] place-items-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">Sem assinatura</span>
                )}
                <div className="flex flex-col gap-2">
                  <label className="btn-ghost cursor-pointer text-sm">
                    {signatureUrl ? "Trocar imagem" : "Enviar imagem"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 500000) { setMsg("Imagem muito grande (máx. ~500 KB)."); return; }
                        const reader = new FileReader();
                        reader.onload = () => setSignatureUrl(String(reader.result || ""));
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                  {signatureUrl && (
                    <button type="button" className="btn-ghost text-sm text-[var(--danger)]" onClick={() => setSignatureUrl("")}>Remover</button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6">
            <LogoUploader />
          </div>

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
