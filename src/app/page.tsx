import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";

const FAQ = [
  {
    q: "Funciona no interior, sem deslocar?",
    a: "Sim. A consulta é 100% online: você escolhe o nefrologista, paga e entra na sala pelo celular ou computador — de qualquer cidade.",
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
    a: "Direto para a conta do médico que você escolheu. A plataforma só organiza agenda, pagamento e sala.",
  },
  {
    q: "É emergência?",
    a: "Não. Em dor forte, falta de ar, desmaio ou suspeita de urgência, procure o pronto-socorro. Meu Rim é para consulta eletiva e acompanhamento online.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-[calc(100vh-76px)] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 animate-soft-pulse"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(201,169,97,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(111,211,138,0.07), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a961' fill-opacity='0.07'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-76px)] max-w-5xl flex-col justify-center px-5 py-16">
          <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.24em] text-[var(--gold)]">
            Nefrologia online para quem não pode esperar a fila
          </p>
          <h1 className="animate-fade-up font-display mt-4 max-w-[10ch] text-5xl leading-[1.02] text-[var(--text)] sm:text-6xl md:text-7xl">
            Meu <span className="text-[var(--gold)]">Rim</span>
          </h1>
          <p className="animate-fade-up-delay mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-soft)]">
            Consulta com nefrologista de verdade, do interior ou da capital —
            pague, receba o link e entre na sala. Sem deslocamento, sem Zoom pago.
          </p>
          <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
            <Link href="/agendar?rapido=1" className="btn-gold">
              Quero consulta online
            </Link>
            <Link href="/medicos/cadastro" className="btn-ghost">
              Sou médico
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Por que existe
        </p>
        <h2 className="font-display mt-3 max-w-2xl text-3xl text-[var(--text)] sm:text-4xl">
          Atendimento presencial ainda deixa muita gente para trás
        </h2>
        <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
          Em várias cidades do interior não há nefrologista perto. Em outras, a
          fila é longa. E quem está com pressa ou prefere online muitas vezes
          não encontra um caminho simples. A Meu Rim nasceu para fechar esse
          buraco — com agenda, pagamento e vídeo no mesmo lugar.
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {[
            {
              t: "Interior e distância",
              d: "Sem viagem, sem hotel, sem perder o dia. O especialista chega pelo celular.",
            },
            {
              t: "Pressa e fila",
              d: "Horários próximos primeiro. Você escolhe, paga e libera a consulta na hora.",
            },
            {
              t: "Online de verdade",
              d: "Sala própria da Meu Rim. O paciente só entra depois do pagamento confirmado.",
            },
          ].map((item) => (
            <div key={item.t} className="border-t border-[var(--border-gold)] pt-5">
              <h3 className="text-lg font-bold text-[var(--text)]">{item.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Como funciona — bem simples
        </p>
        <h2 className="font-display mt-3 text-3xl text-[var(--text)] sm:text-4xl">
          Quatro passos. Todo mundo entende.
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "01",
              t: "Escolha o médico",
              d: "Veja CRM, especialidade e valor. São colegas nefrologistas da rede Meu Rim.",
            },
            {
              n: "02",
              t: "Escolha o horário",
              d: "Agenda real do médico. Os mais próximos aparecem no topo se você está com pressa.",
            },
            {
              n: "03",
              t: "Pague e liberamos",
              d: "Pix, cartão ou boleto. O valor vai para a conta do médico escolhido.",
            },
            {
              n: "04",
              t: "Entre na consulta",
              d: "E-mail + link da sala Meu Rim. No horário, paciente e médico entram juntos.",
            },
          ].map((step) => (
            <li key={step.n} className="border-t border-[var(--border-gold)] pt-5">
              <span className="font-display text-2xl text-[var(--gold)]">{step.n}</span>
              <h3 className="mt-3 text-lg font-bold text-[var(--text)]">{step.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{step.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link href="/agendar" className="btn-gold">
            Começar agendamento
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div
          className="relative overflow-hidden rounded-[30px] border border-[var(--border-gold)] px-6 py-12 sm:px-12"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(201,169,97,0.14), transparent 40%), linear-gradient(180deg, rgba(19,19,19,0.96), rgba(10,10,10,0.98))",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
            Espalhe a ideia
          </p>
          <h2 className="font-display mt-3 max-w-xl text-3xl text-[var(--text)] sm:text-4xl">
            Quem precisa de rim não pode depender só da sorte geográfica
          </h2>
          <p className="mt-4 max-w-lg text-[var(--text-soft)]">
            Mande a Meu Rim para um familiar no interior, um grupo de pacientes
            ou um colega médico. Quanto mais gente souber, menos gente fica sem
            acesso.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ShareButton />
            <Link href="/agendar?rapido=1" className="btn-ghost">
              Agendar agora
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Para a equipe médica
        </p>
        <h2 className="font-display mt-3 text-3xl text-[var(--text)] sm:text-4xl">
          Vocês atendem. A plataforma organiza.
        </h2>
        <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
          Cadastre CRM, Pix ou conta, defina os dias e o valor. Quando o
          paciente paga, a consulta libera e o dinheiro vai para você. Sem
          pagar Zoom. Sem planilha. Até cerca de 20 colegas na mesma rede.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/medicos/cadastro" className="btn-gold">
            Cadastrar minha conta
          </Link>
          <Link href="/medicos/login" className="btn-ghost">
            Já tenho conta
          </Link>
        </div>
      </section>

      <section id="perguntas" className="mx-auto max-w-3xl px-5 pb-24">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Perguntas claras
        </p>
        <h2 className="font-display mt-3 text-3xl text-[var(--text)]">
          Para a gente se entender
        </h2>
        <div className="mt-8 space-y-4">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group border-b border-[var(--border)] pb-4"
            >
              <summary className="cursor-pointer list-none py-2 text-left text-lg font-semibold text-[var(--text)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-4">
                  {item.q}
                  <span className="text-[var(--gold)] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="pt-1 text-sm leading-relaxed text-[var(--text-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
