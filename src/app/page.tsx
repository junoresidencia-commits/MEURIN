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
      <section className="mx-auto max-w-5xl px-5 pb-4 pt-10 sm:pt-14">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-sm font-extrabold text-white shadow-[var(--shadow-gold)]">MR</span>
          <span className="font-display text-xl font-extrabold text-[var(--text)]">meu <span className="text-[var(--gold)]">rim</span></span>
        </div>
        <p className="animate-fade-up mt-6 text-sm font-semibold text-[var(--gold)]">Fala para o seu rim.</p>
        <h1 className="animate-fade-up font-display mt-2 max-w-[16ch] text-4xl font-extrabold leading-[1.05] text-[var(--text)] sm:text-5xl">
          Cuidado renal que acompanha você.
        </h1>
        <p className="animate-fade-up-delay mt-4 max-w-xl text-lg leading-relaxed text-[var(--text-soft)]">
          Consultas, exames, evolução e orientação em um só lugar.
        </p>
        <div className="animate-fade-up-delay mt-6 flex max-w-md flex-col gap-3">
          <Link href="/agendar" className="btn-gold w-full" onClick={() => trackEvent("cta_agendar_home")}>
            Agendar consulta
          </Link>
          <Link href="/paciente/entrar" className="btn-ghost w-full">
            Entrar
          </Link>
        </div>

        {/* Portas de entrada — paciente, profissional, atendente */}
        <div className="animate-fade-up-delay mt-8 grid max-w-md grid-cols-3 gap-3">
          <Link href="/paciente/entrar" onClick={() => trackEvent("portal_paciente")} className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white py-4 text-center shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--gold-soft)] text-[var(--gold)]"><UserIcon className="h-5 w-5" /></span>
            <span className="text-xs font-bold text-[var(--text-soft)]">Sou paciente</span>
          </Link>
          <Link href="/medicos/login" onClick={() => trackEvent("portal_medico")} className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white py-4 text-center shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--gold-soft)] text-[var(--gold)]"><StethoscopeIcon className="h-5 w-5" /></span>
            <span className="text-xs font-bold text-[var(--text-soft)]">Sou profissional</span>
          </Link>
          <Link href="/atendente/login" className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-white py-4 text-center shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--gold-soft)] text-[var(--gold)]"><HeadsetIcon className="h-5 w-5" /></span>
            <span className="text-xs font-bold text-[var(--text-soft)]">Sou atendente</span>
          </Link>
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <LockIcon className="h-4 w-4 text-[var(--gold)]" />
          Seus dados estão seguros e protegidos com criptografia.
        </p>
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
