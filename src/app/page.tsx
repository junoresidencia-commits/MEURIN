import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-[calc(100vh-76px)] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 animate-soft-pulse"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(201,169,97,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(111,211,138,0.06), transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9a961' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-76px)] max-w-5xl flex-col justify-center px-5 py-16">
          <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.24em] text-[var(--gold)]">
            Nefrologia online · plataforma própria
          </p>
          <h1 className="animate-fade-up font-display mt-4 max-w-[11ch] text-5xl leading-[1.02] text-[var(--text)] sm:text-6xl md:text-7xl">
            Meu <span className="text-[var(--gold)]">Rim</span>
          </h1>
          <p className="animate-fade-up-delay mt-6 max-w-xl text-lg text-[var(--text-soft)]">
            Escolha o nefrologista, veja os horários, pague e receba o link da
            consulta por e-mail — tudo em um só lugar, sem Zoom pago.
          </p>
          <div className="animate-fade-up-delay mt-8 flex flex-wrap gap-3">
            <Link href="/agendar" className="btn-gold">
              Agendar consulta
            </Link>
            <Link href="/medicos/cadastro" className="btn-ghost">
              Sou médico — cadastrar
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
          Como funciona
        </p>
        <h2 className="font-display mt-3 text-3xl text-[var(--text)] sm:text-4xl">
          Do pagamento à consulta em quatro passos
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "01",
              t: "Escolha o médico",
              d: "Até 20 colegas nefrologistas com perfil, CRM e valor da consulta.",
            },
            {
              n: "02",
              t: "Veja a agenda",
              d: "Horários liberados por cada médico — você escolhe o que cabe na sua rotina.",
            },
            {
              n: "03",
              t: "Pague e libere",
              d: "Cartão, Pix ou boleto. O valor vai para a conta do médico escolhido.",
            },
            {
              n: "04",
              t: "Entre na sala",
              d: "E-mail com link da videoconsulta na própria Meu Rim — sem app externo.",
            },
          ].map((step) => (
            <div key={step.n} className="border-t border-[var(--border-gold)] pt-5">
              <span className="font-display text-2xl text-[var(--gold)]">{step.n}</span>
              <h3 className="mt-3 text-lg font-bold text-[var(--text)]">{step.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-[30px] border border-[var(--border-gold)] px-6 py-12 text-center sm:px-12"
          style={{
            background:
              "radial-gradient(circle at top, rgba(201,169,97,0.16), transparent 42%), linear-gradient(180deg, rgba(19,19,19,0.96), rgba(10,10,10,0.98))",
          }}
        >
          <h2 className="font-display text-3xl text-[var(--gold-light)] sm:text-4xl">
            Para a equipe médica
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[var(--text-soft)]">
            Vocês se cadastram, definem horários e recebem o pagamento na conta.
            O paciente só entra na sala depois de pagar.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/medicos/cadastro" className="btn-gold">
              Cadastrar minha conta
            </Link>
            <Link href="/educacao" className="btn-ghost">
              Conteúdo educativo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
