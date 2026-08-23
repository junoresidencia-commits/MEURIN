"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { trackEvent } from "@/lib/analytics-client";

const CONSULTA_INFOS = [
  { t: "Consulta nefrológica", d: "Avaliação médica, análise dos exames disponíveis e documentos quando indicados." },
  { t: "Segunda opinião", d: "Para quem já tem exames, diagnóstico ou tratamento e quer nova avaliação." },
  { t: "Online ou presencial", d: "Conforme a modalidade oferecida pelo nefrologista." },
  { t: "Acompanhamento contínuo", d: "Exames, documentos e evolução renal ficam organizados no Meu Rim." },
];

const FEATURES = [
  {
    t: "Registre seus dados",
    d: "Pressão, glicemia, peso e sintomas do seu dia a dia.",
    icon: HeartIcon,
  },
  {
    t: "Cuide da alimentação",
    d: "Acompanhe sódio, potássio e fósforo com orientação.",
    icon: UtensilsIcon,
  },
  {
    t: "Alertas com contexto",
    d: "Avisos educativos que respeitam o plano do seu médico.",
    icon: BellIcon,
  },
  {
    t: "Aprenda e se cuide",
    d: "Conteúdos claros sobre creatinina, TFGe e proteção renal.",
    icon: BookIcon,
  },
];

const STEPS = [
  { n: "1", t: "Encontre seu nefrologista", d: "Veja especialidade, CRM, RQE e modalidades disponíveis." },
  { n: "2", t: "Escolha o melhor horário", d: "Consulte a agenda disponibilizada pelo médico." },
  { n: "3", t: "Faça sua consulta", d: "Online ou presencial, conforme o profissional oferecer." },
  { n: "4", t: "Continue seu acompanhamento", d: "Exames, documentos e evolução renal permanecem organizados no Meu Rim." },
];

const BENEFITS = [
  { t: "Acesso à distância", d: "Nefrologista mesmo longe dos grandes centros." },
  { t: "Menos deslocamento", d: "Teleconsulta quando for clinicamente apropriada." },
  { t: "Acompanhamento renal", d: "Creatinina, TFGe, proteinúria e pressão organizados." },
  { t: "Segunda opinião", d: "Nova avaliação com exames e histórico em mãos." },
  { t: "Histórico contínuo", d: "Documentos e evolução disponíveis após a consulta." },
  { t: "Médico e paciente conectados", d: "Prontuário profissional + área do paciente no mesmo ecossistema." },
];

const HELP_OPTIONS = [
  {
    id: "creatinina",
    t: "Minha creatinina está alta",
    d: "A creatinina elevada pode indicar alteração da função renal. Um nefrologista avalia o contexto clínico e os demais exames.",
  },
  {
    id: "proteina",
    t: "Tenho proteína na urina",
    d: "Proteinúria ou RAC aumentada merecem avaliação especializada para investigar causas e acompanhar a evolução.",
  },
  {
    id: "drc",
    t: "Tenho doença renal crônica",
    d: "O acompanhamento longitudinal ajuda a preservar a função renal e organizar exames, pressão e tratamentos.",
  },
  {
    id: "segunda",
    t: "Quero uma segunda opinião",
    d: "Útil quando já existem exames, diagnóstico ou tratamento e você deseja uma nova avaliação nefrológica.",
  },
  {
    id: "acompanhamento",
    t: "Preciso de acompanhamento renal",
    d: "Para hipertensão associada, glomerulopatias, alterações urinárias e outras condições que pedem continuidade.",
  },
  {
    id: "consulta",
    t: "Quero consultar um nefrologista",
    d: "Encontre um profissional, escolha horário online ou presencial e inicie seu cuidado no Meu Rim.",
  },
] as const;

const FAQ = [
  {
    q: "O Meu Rim é só teleconsulta?",
    a: "Não. É um ecossistema de cuidado renal: prontuário nefrológico, consulta online ou presencial e acompanhamento contínuo entre médico e paciente.",
  },
  {
    q: "O médico pode usar o prontuário sem teleconsulta?",
    a: "Sim. Depois de um atendimento presencial em qualquer clínica ou hospital, o médico pode cadastrar o paciente e manter o prontuário no Meu Rim.",
  },
  {
    q: "O paciente altera o prontuário médico?",
    a: "Não. Evolução, diagnóstico, prescrição e documentos clínicos ficam sob responsabilidade do médico. O paciente alimenta sua área de acompanhamento, claramente identificada.",
  },
  {
    q: "Funciona no interior?",
    a: "Sim. A teleconsulta e o acompanhamento pelo celular ajudam quem está longe dos grandes centros, quando a modalidade online for adequada.",
  },
  {
    q: "É emergência?",
    a: "Não. Em dor forte, falta de ar, desmaio ou urgência, procure o pronto-socorro. O Meu Rim é para consulta eletiva e acompanhamento.",
  },
];

export default function HomePage() {
  const [helpId, setHelpId] = useState<(typeof HELP_OPTIONS)[number]["id"] | null>(null);
  const selectedHelp = useMemo(
    () => HELP_OPTIONS.find((h) => h.id === helpId) || null,
    [helpId]
  );

  useEffect(() => {
    trackEvent("home_view");
  }, []);

  return (
    <>
      {/* Hero premium — halo + grade + ilustração renal com rede vascular */}
      <section className="relative overflow-hidden">
        {/* Fundo em camadas: grade de pontos + orbes desfocados */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="hero-dots absolute inset-0" />
          <div className="animate-float-slow absolute -left-32 top-8 h-96 w-96 rounded-full bg-[var(--gold)]/15 blur-[120px]" />
          <div className="animate-float absolute -right-20 -top-20 h-[30rem] w-[30rem] rounded-full bg-[#13b3bc]/15 blur-[130px]" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[var(--gold)]/10 blur-[110px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-8 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Coluna do texto */}
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-white/80 py-1.5 pl-2 pr-4 text-xs font-bold text-[var(--gold)] shadow-[var(--shadow)] backdrop-blur">
              <KidneyMark className="h-5 w-5" />
              Nefrologia que acompanha você
            </span>
            <h1 className="font-display mt-5 text-[2.6rem] font-extrabold leading-[1.03] tracking-tight sm:text-6xl">
              <span className="text-hero-gradient">Cuidado renal</span>
              <br />
              <span className="text-[var(--text)]">que </span>
              <span className="text-[var(--gold)]">acompanha</span>
              <span className="text-[var(--text)]"> você.</span>
            </h1>
            <p className="animate-fade-up-delay mt-5 max-w-lg text-lg leading-relaxed text-[var(--text-soft)]">
              Consultas, exames, evolução e orientação — do agendamento ao acompanhamento contínuo, num só lugar.
            </p>
            <div className="animate-fade-up-delay mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/agendar" className="btn-gold px-8 text-base sm:w-auto" onClick={() => trackEvent("cta_agendar_home")}>
                <CalendarIcon className="h-5 w-5" /> Agendar consulta
              </Link>
              <Link href="/paciente/entrar" className="btn-ghost px-8 text-base sm:w-auto">
                Entrar
              </Link>
            </div>

            {/* Prova social / confiança */}
            <div className="animate-fade-up-delay mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5"><ShieldIcon className="h-4 w-4 text-[var(--gold)]" /> Dados criptografados</span>
              <span className="inline-flex items-center gap-1.5"><CheckMini className="h-4 w-4 text-[var(--gold)]" /> Conforme a LGPD</span>
              <span className="inline-flex items-center gap-1.5"><CheckMini className="h-4 w-4 text-[var(--gold)]" /> Online ou presencial</span>
            </div>

            {/* Portas de entrada — cartões premium */}
            <div className="animate-fade-up-delay mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { href: "/paciente/entrar", ev: "portal_paciente", icon: UserIcon, label: "Sou paciente" },
                { href: "/medicos/login", ev: "portal_medico", icon: StethoscopeIcon, label: "Sou profissional" },
                { href: "/atendente/login", ev: "", icon: HeadsetIcon, label: "Sou atendente" },
              ].map((p) => (
                <Link
                  key={p.label}
                  href={p.href}
                  onClick={() => p.ev && trackEvent(p.ev)}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/80 py-4 text-center shadow-[var(--shadow)] backdrop-blur transition hover:-translate-y-1 hover:border-[var(--border-gold)] hover:shadow-[var(--shadow-gold)]"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gold-soft)] text-[var(--gold)] transition group-hover:scale-110">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-[var(--text-soft)]">{p.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Coluna da ilustração renal */}
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div className="animate-float">
              <KidneyHero className="w-full drop-shadow-[0_30px_60px_rgba(8,123,130,0.28)]" />
            </div>
            {/* Chips de vidro flutuantes */}
            <div className="glass animate-float-slow absolute left-0 top-6 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]"><PulseIcon className="h-4 w-4" /></span>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">TFGe</p>
                <p className="text-sm font-extrabold text-[var(--text)]">78 <span className="text-[var(--green)]">estável</span></p>
              </div>
            </div>
            <div className="glass animate-float absolute bottom-8 right-0 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]"><CheckMini className="h-4 w-4" /></span>
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Creatinina</p>
                <p className="text-sm font-extrabold text-[var(--text)]">1,1 mg/dL</p>
              </div>
            </div>
          </div>
        </div>

        {/* Onda inferior suave */}
        <svg className="relative block w-full" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" style={{ height: 44 }}>
          <path d="M0 45 C 240 100, 480 5, 720 35 C 960 65, 1200 12, 1440 45 L1440 90 L0 90 Z" fill="var(--gold-soft)" opacity="0.75" />
        </svg>
      </section>

      {/* Consulta + continuidade */}
      <section className="mx-auto max-w-5xl px-5 pb-6">
        <div className="animate-fade-up-delay relative overflow-hidden rounded-[28px] border border-[var(--border-gold)] bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] p-7 text-white shadow-[var(--shadow-gold)] sm:p-9">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <CalendarIcon className="h-4 w-4" /> Consulta online com nefrologista
              </span>
              <h2 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
                Sua consulta termina. Seu acompanhamento não precisa terminar.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/90">
                Agende, consulte e continue com exames, documentos e evolução
                renal no mesmo ecossistema.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/agendar"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-[var(--gold)] shadow-lg transition hover:-translate-y-0.5"
                  onClick={() => trackEvent("cta_agendar_destaque")}
                >
                  Agendar consulta
                </Link>
                <Link
                  href="/paciente/entrar"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border-[1.5px] border-white/60 px-6 text-sm font-extrabold text-white transition hover:bg-white/10"
                >
                  Já sou paciente
                </Link>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:w-[46%] lg:grid-cols-1">
              {CONSULTA_INFOS.map((info) => (
                <li
                  key={info.t}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                  <span>
                    <span className="block text-sm font-bold">{info.t}</span>
                    <span className="block text-xs text-white/80">{info.d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Portas de entrada */}
      <section className="mx-auto max-w-5xl px-5 pb-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/paciente/entrar"
            className="group flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
            onClick={() => trackEvent("portal_paciente")}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
              <UserIcon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-[var(--text)]">
                Já sou paciente
              </span>
              <span className="mt-1 block text-sm text-[var(--text-muted)]">
                Entre na área Meu Rim para exames, documentos e acompanhamento.
              </span>
            </span>
            <ArrowIcon className="h-8 w-8 shrink-0 text-[var(--gold)] transition group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/medicos/login"
            className="group flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
            onClick={() => trackEvent("portal_medico")}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
              <StethoscopeIcon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-[var(--text)]">
                Sou médico
              </span>
              <span className="mt-1 block text-sm text-[var(--text-muted)]">
                Prontuário nefrológico, pacientes, documentos e agenda onde você estiver.
              </span>
            </span>
            <ArrowIcon className="h-8 w-8 shrink-0 text-[var(--gold)] transition group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/educacao"
            className="group flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
              <BookIcon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-[var(--text)]">
                Dúvida renal
              </span>
              <span className="mt-1 block text-sm text-[var(--text-muted)]">
                Entenda creatinina, TFGe e cuidados — em linguagem simples.
              </span>
            </span>
            <ArrowIcon className="h-8 w-8 shrink-0 text-[var(--gold)] transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-[var(--text-muted)]">
          <LockIcon className="h-4 w-4 text-[var(--gold)]" />
          Seus dados são protegidos com criptografia e controle de acesso.
        </p>
      </section>

      {/* Como podemos ajudar */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <p className="text-sm font-semibold text-[var(--gold)]">Como podemos ajudar?</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Escolha o que melhor descreve sua situação
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setHelpId(opt.id);
                trackEvent("help_option", { option: opt.id });
              }}
              className={`rounded-[22px] border p-5 text-left shadow-[var(--shadow)] transition hover:-translate-y-0.5 ${
                helpId === opt.id
                  ? "border-[var(--gold)] bg-[var(--gold-soft)]"
                  : "border-[var(--border)] bg-white"
              }`}
            >
              <h3 className="text-base font-bold text-[var(--text)]">{opt.t}</h3>
            </button>
          ))}
        </div>
        {selectedHelp && (
          <div className="panel mt-5">
            <p className="text-sm leading-relaxed text-[var(--text-soft)]">{selectedHelp.d}</p>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Isto não é diagnóstico automático. A avaliação é sempre clínica, com um nefrologista.
            </p>
            <Link
              href={`/agendar?motivo=${selectedHelp.id === "segunda" ? "segunda_opiniao" : selectedHelp.id === "acompanhamento" || selectedHelp.id === "drc" || selectedHelp.id === "creatinina" || selectedHelp.id === "proteina" ? "acompanhamento" : "outro"}`}
              className="btn-gold mt-4 inline-flex"
              onClick={() => trackEvent("help_find_doctor", { option: selectedHelp.id })}
            >
              Encontrar um nefrologista
            </Link>
          </div>
        )}
      </section>

      {/* Benefícios */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <p className="text-sm font-semibold text-[var(--gold)]">O que o Meu Rim resolve</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Cuidado renal com continuidade
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.t} className="rounded-[22px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)]">
              <h3 className="text-base font-bold text-[var(--text)]">{b.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recursos paciente */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <p className="text-sm font-semibold text-[var(--gold)]">Para pacientes</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Consulte. Acompanhe. Entenda melhor sua saúde renal.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ t, d, icon: Icon }) => (
            <div key={t} className="rounded-[22px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-[var(--text)]">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <p className="text-sm font-semibold text-[var(--gold)]">Como funciona</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Quatro passos simples
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-[22px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)]">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--gold)] text-sm font-extrabold text-white">
                {step.n}
              </span>
              <h3 className="mt-4 text-base font-bold text-[var(--text)]">{step.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{step.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link href="/agendar" className="btn-gold" onClick={() => trackEvent("cta_comecar_agendamento")}>
            Começar agendamento
          </Link>
        </div>
      </section>

      {/* Acompanhamento */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="rounded-[28px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-7 sm:p-9">
          <p className="text-sm font-semibold text-[var(--gold)]">Acompanhamento renal</p>
          <h2 className="font-display mt-2 max-w-2xl text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
            Depois da consulta, o cuidado continua organizado
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
            Conforme liberação do profissional: receitas, pedidos de exame,
            relatórios, creatinina, TFGe, proteinúria/RAC, pressão, peso, exames
            enviados e próxima consulta — no mesmo lugar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/paciente/entrar" className="btn-gold">
              Abrir área do paciente
            </Link>
            <Link href="/agendar" className="btn-ghost">
              Agendar agora
            </Link>
          </div>
        </div>
      </section>

      {/* Compartilhar */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="rounded-[28px] border border-[var(--border)] bg-white p-7 shadow-[var(--shadow)] sm:p-9">
          <h2 className="font-display max-w-xl text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
            Ajude alguém a cuidar dos rins
          </h2>
          <p className="mt-3 max-w-lg text-[var(--text-soft)]">
            Compartilhe a Meu Rim com um familiar no interior, um grupo de
            pacientes ou um colega profissional.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ShareButton />
            <Link href="/agendar?rapido=1" className="btn-ghost">
              Agendar agora
            </Link>
          </div>
        </div>
      </section>

      {/* Para profissionais */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <p className="text-sm font-semibold text-[var(--gold)]">Para a equipe de saúde</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Seu prontuário nefrológico onde você estiver.
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          Atenda presencialmente ou online e mantenha pacientes, exames,
          documentos e evolução renal organizados. A teleconsulta é uma
          funcionalidade — o centro é o prontuário e o acompanhamento.
        </p>
        <ul className="mt-5 grid gap-2 text-sm text-[var(--text-soft)] sm:grid-cols-2">
          {[
            "Prontuário online e cadastro de pacientes",
            "Evolução, receitas, pedidos e relatórios",
            "LME, documentos e padrões",
            "Gráficos e acompanhamento laboratorial",
            "Agenda com locais e modalidades",
            "Integração com a área do paciente",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/medicos/cadastro" className="btn-gold">
            Cadastrar minha conta
          </Link>
          <Link href="/medicos/login" className="btn-ghost">
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="perguntas" className="mx-auto max-w-3xl px-5 pb-20">
        <p className="text-sm font-semibold text-[var(--gold)]">Perguntas claras</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Para a gente se entender
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-[var(--border)] bg-white px-5 py-1 shadow-[var(--shadow)]"
            >
              <summary className="cursor-pointer list-none py-4 text-left text-base font-semibold text-[var(--text)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.q}
                  <span className="text-xl leading-none text-[var(--gold)] transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-[var(--text-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

/* --- Ícones lineares (estilo Lucide) — preservados --- */
type IconProps = { className?: string };

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 3v6a5 5 0 0 0 10 0V3M4 3H2m2 0h2m6 0h2m-2 0h-2M9 21a5 5 0 0 0 5-5v-2" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M10 8l4 4-4 4" />
    </svg>
  );
}

function KidneyMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--gold-dark)" />
        </linearGradient>
      </defs>
      <path d="M25 8c-9 0-15 8-15 18 0 12 7 22 15 22 5 0 8-4 8-9V17c0-6-3-9-8-9Z" fill="url(#kg)" />
      <path d="M39 8c9 0 15 8 15 18 0 12-7 22-15 22-5 0-8-4-8-9V17c0-6 3-9 8-9Z" fill="url(#kg)" opacity="0.88" />
      <circle cx="22" cy="20" r="2.4" fill="#fff" opacity="0.9" />
      <circle cx="42" cy="20" r="2.4" fill="#fff" opacity="0.9" />
    </svg>
  );
}

/* Ilustração premium: rim anatômico com rede vascular e nós pulsando. */
function KidneyHero({ className }: IconProps) {
  return (
    <svg viewBox="0 0 440 440" className={className} fill="none" aria-hidden="true" role="img">
      <defs>
        <radialGradient id="halo" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#13b3bc" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#087b82" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#087b82" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kidneyBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0fa3ac" />
          <stop offset="55%" stopColor="#087b82" />
          <stop offset="100%" stopColor="#055159" />
        </linearGradient>
        <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Halo suave */}
      <circle cx="220" cy="195" r="185" fill="url(#halo)" />
      <circle cx="220" cy="195" r="150" stroke="#13b3bc" strokeOpacity="0.14" strokeWidth="1.5" fill="none" />
      <circle cx="220" cy="195" r="120" stroke="#13b3bc" strokeOpacity="0.1" strokeWidth="1.5" fill="none" />

      {/* Corpo do rim */}
      <path
        d="M262 70 C 350 70 396 150 396 228 C 396 322 322 372 250 362 C 214 357 196 328 205 292 C 216 248 258 246 258 200 C 258 152 214 150 205 116 C 197 84 216 70 262 70 Z"
        fill="url(#kidneyBody)"
      />
      {/* Brilho superior (glossy) */}
      <path
        d="M262 84 C 322 84 360 132 372 190 C 320 150 262 156 250 132 C 244 120 246 96 262 84 Z"
        fill="url(#gloss)"
      />

      {/* Rede vascular interna */}
      <g stroke="#e9fbfc" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M232 300 C 250 268 250 236 236 208 C 224 184 244 156 268 150" />
        <path d="M236 208 C 262 214 292 206 312 186" />
        <path d="M250 236 C 276 244 306 240 330 224" />
        <path d="M250 268 C 280 276 314 272 340 254" />
        <path d="M268 150 C 296 150 322 162 338 186" />
      </g>
      {/* Vasos entrando pela chanfradura (artéria/veia renal) */}
      <g stroke="#0fa3ac" strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M205 214 C 176 214 150 206 128 214" strokeOpacity="0.9" />
        <path d="M212 246 C 184 250 156 260 134 254" strokeOpacity="0.6" />
      </g>

      {/* Nós luminosos pulsando */}
      <g fill="#ffffff">
        <circle cx="268" cy="150" r="4.2" style={{ animation: "node-pulse 2.8s ease-in-out infinite" }} />
        <circle cx="312" cy="186" r="3.6" style={{ animation: "node-pulse 3.4s ease-in-out .3s infinite" }} />
        <circle cx="330" cy="224" r="3.6" style={{ animation: "node-pulse 2.4s ease-in-out .6s infinite" }} />
        <circle cx="340" cy="254" r="3.4" style={{ animation: "node-pulse 3.1s ease-in-out .9s infinite" }} />
        <circle cx="236" cy="208" r="4" style={{ animation: "node-pulse 2.6s ease-in-out .15s infinite" }} />
      </g>

      {/* Partículas orbitais externas */}
      <g fill="#13b3bc">
        <circle cx="96" cy="120" r="4" className="animate-soft-pulse" />
        <circle cx="360" cy="96" r="3" className="animate-soft-pulse" />
        <circle cx="120" cy="320" r="3.5" className="animate-soft-pulse" />
      </g>
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckMini({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function PulseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

function HeadsetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Zm16 0a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z" />
      <path d="M18 19a4 4 0 0 1-4 3h-2" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
    </svg>
  );
}

function UtensilsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9M18 3c-1.7 0-3 2-3 5s1 4 3 4v9" />
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function BookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
      <path d="M19 17H6a2 2 0 0 0-2 2" />
    </svg>
  );
}
