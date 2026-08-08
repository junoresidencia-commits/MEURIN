import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";

const CONSULTA_INFOS = [
  { t: "Atendimento seguro", d: "Sala de vídeo própria, com acesso controlado." },
  { t: "Escolha de horário", d: "Agenda real do profissional, sem espera na fila." },
  { t: "Pagamento online", d: "Pix, cartão ou boleto — direto para o médico." },
  { t: "No seu dispositivo", d: "Celular, tablet ou computador, de onde estiver." },
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
  { n: "1", t: "Escolha o profissional", d: "Veja especialidade, CRM e valor da consulta." },
  { n: "2", t: "Escolha o horário", d: "Os horários mais próximos aparecem primeiro." },
  { n: "3", t: "Informe seus dados", d: "Nome, e-mail e motivo — e aceite os termos." },
  { n: "4", t: "Pague e confirme", d: "Receba o link da sala e entre no horário marcado." },
];

const FAQ = [
  {
    q: "Funciona no interior, sem deslocar?",
    a: "Sim. A consulta é 100% online: você escolhe o profissional, paga e entra na sala pelo celular ou computador — de qualquer cidade.",
  },
  {
    q: "Estou com pressa. Consigo horário rápido?",
    a: "No agendamento, os horários mais próximos aparecem primeiro. Pague, confirme e receba o link na hora por e-mail.",
  },
  {
    q: "Preciso de Zoom ou outro app pago?",
    a: "Não. A sala de vídeo é da própria Meu Rim. Depois do pagamento, o link libera a consulta.",
  },
  {
    q: "Para onde vai o dinheiro?",
    a: "Direto para a conta do profissional que você escolheu. A plataforma organiza agenda, pagamento e sala.",
  },
  {
    q: "É emergência?",
    a: "Não. Em dor forte, falta de ar, desmaio ou suspeita de urgência, procure o pronto-socorro. Meu Rim é para consulta eletiva e acompanhamento online.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pb-4 pt-10 sm:pt-14">
        <p className="animate-fade-up text-sm font-semibold text-[var(--gold)]">
          Meu Rim
        </p>
        <h1 className="animate-fade-up font-display mt-2 max-w-[16ch] text-4xl font-extrabold leading-[1.05] text-[var(--text)] sm:text-5xl">
          Cuidado que acompanha você, todos os dias.
        </h1>
        <p className="animate-fade-up-delay mt-4 max-w-xl text-lg leading-relaxed text-[var(--text-soft)]">
          Consulta online com nefrologista e acompanhamento da sua saúde renal —
          do interior ou da capital, sem deslocamento.
        </p>
      </section>

      {/* Consulta online — primeiro destaque */}
      <section className="mx-auto max-w-5xl px-5 pb-6">
        <div className="animate-fade-up-delay relative overflow-hidden rounded-[28px] border border-[var(--border-gold)] bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] p-7 text-white shadow-[var(--shadow-gold)] sm:p-9">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <CalendarIcon className="h-4 w-4" /> Consulta online
              </span>
              <h2 className="font-display mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
                Agende sua consulta online
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/90">
                Escolha o profissional, o melhor horário e faça sua consulta de
                onde estiver.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/agendar"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-[var(--gold)] shadow-lg transition hover:-translate-y-0.5"
                >
                  Agendar consulta
                </Link>
                <Link
                  href="/agendar?rapido=1"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-full border-[1.5px] border-white/60 px-6 text-sm font-extrabold text-white transition hover:bg-white/10"
                >
                  Estou com pressa
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

      {/* Entradas de perfil — as portas do Meu Rim */}
      <section className="mx-auto max-w-5xl px-5 pb-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/paciente/entrar"
            className="group flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
              <UserIcon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-[var(--text)]">
                Sou paciente
              </span>
              <span className="mt-1 block text-sm text-[var(--text-muted)]">
                Entre ou crie sua conta (nome e CPF) para acompanhar sua saúde.
              </span>
            </span>
            <ArrowIcon className="h-8 w-8 shrink-0 text-[var(--gold)] transition group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/medicos/login"
            className="group flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow)] transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
              <StethoscopeIcon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block text-base font-bold text-[var(--text)]">
                Área do médico
              </span>
              <span className="mt-1 block text-sm text-[var(--text-muted)]">
                Entre para gerenciar pacientes, consultas, exames e documentos.
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
                Entenda seus rins, exames e cuidados — em linguagem simples.
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

      {/* Recursos */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <p className="text-sm font-semibold text-[var(--gold)]">Para pacientes</p>
        <h2 className="font-display mt-2 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
          Acompanhe sua saúde de onde estiver
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
          <Link href="/agendar" className="btn-gold">
            Começar agendamento
          </Link>
        </div>
      </section>

      {/* Compartilhar */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="rounded-[28px] border border-[var(--border-gold)] bg-[var(--gold-soft)] p-7 sm:p-9">
          <h2 className="font-display max-w-xl text-2xl font-extrabold text-[var(--text)] sm:text-3xl">
            Ajude alguém a cuidar dos rins
          </h2>
          <p className="mt-3 max-w-lg text-[var(--text-soft)]">
            Compartilhe a Meu Rim com um familiar no interior, um grupo de
            pacientes ou um colega profissional. Quanto mais gente souber, menos
            gente fica sem acesso.
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
          Você atende. A plataforma organiza.
        </h2>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          Cadastre CRM, Pix ou conta, defina os dias e o valor. Quando o paciente
          paga, a consulta libera e o valor vai para você — sem pagar Zoom, sem
          planilha.
        </p>
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

/* --- Ícones lineares (estilo Lucide) --- */
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
