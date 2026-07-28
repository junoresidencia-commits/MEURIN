import Link from "next/link";

const DONE = [
  {
    t: "Site e marca Meu Rim",
    d: "Landing, tom de voz (interior / fila / pressa) e compartilhar no WhatsApp.",
  },
  {
    t: "Cadastro de médicos",
    d: "CRM, Pix, valor, agenda semanal e painel com consultas liberadas.",
  },
  {
    t: "Agendamento do paciente",
    d: "Médico → horário → dados/cidade/motivo → pagamento → liberação.",
  },
  {
    t: "Sala de vídeo própria",
    d: "WebRTC na Meu Rim. Paciente só entra depois de pagar.",
  },
  {
    t: "E-mail de confirmação (simulado)",
    d: "Texto pronto no log do servidor — falta só plugar Resend/SendGrid.",
  },
  {
    t: "Educação renal",
    d: "Calculadora CKD-EPI em /educacao.",
  },
  {
    t: "Páginas legais stub",
    d: "Termos e privacidade básicos para o site ir ao ar.",
  },
];

const YOU = [
  {
    t: "1. Conta de hospedagem",
    d: "Criar conta na Vercel (ou similar) e conectar o GitHub MEURIN. Deploy = botão.",
  },
  {
    t: "2. Domínio",
    d: "Comprar ou apontar DNS (ex.: meurim.com.br) para a Vercel. Ajustar NEXT_PUBLIC_APP_URL.",
  },
  {
    t: "3. Pagamento real",
    d: "Abrir Mercado Pago (Split) ou Stripe Connect. Colocar as chaves no .env da Vercel.",
  },
  {
    t: "4. E-mail real",
    d: "Conta Resend ou SendGrid + domínio verificado para o paciente receber o link de verdade.",
  },
  {
    t: "5. Banco de dados",
    d: "Criar Postgres (Supabase free serve). Migrar de data/db.json para não perder agenda.",
  },
  {
    t: "6. Vocês, os médicos",
    d: "Cada colega cadastra CRM real, Pix real e agenda real. Apagar contas demo.",
  },
  {
    t: "7. CNPJ / responsabilidade",
    d: "Definir quem é a PJ da plataforma (ou cooperativa) para receber taxa e emitir nota, se houver.",
  },
];

export default function AmanhaPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">
        Pronto para amanhã
      </p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">
        Zero dúvida do que já está feito
      </h1>
      <p className="mt-4 text-[var(--text-soft)]">
        O produto demo está completo para você testar o fluxo inteiro hoje.
        Amanhã, o que falta é conta, domínio e chaves reais — não falta inventar
        a aplicação.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-[var(--green)]">Já está pronto</h2>
        <ul className="mt-6 space-y-4">
          {DONE.map((item) => (
            <li key={item.t} className="border-t border-[var(--border)] pt-4">
              <p className="font-bold text-[var(--text)]">✓ {item.t}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl text-[var(--gold)]">
          Só você resolve amanhã
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Eu não consigo criar essas contas por você. Ordem sugerida:
        </p>
        <ol className="mt-6 space-y-4">
          {YOU.map((item) => (
            <li key={item.t} className="border-t border-[var(--border-gold)] pt-4">
              <p className="font-bold text-[var(--text)]">{item.t}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel mt-12">
        <h2 className="font-display text-xl text-[var(--text)]">Testar agora (5 min)</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--text-soft)]">
          <li>
            Abra <Link className="text-[var(--gold-light)]" href="/agendar?rapido=1">/agendar</Link> e
            marque uma consulta demo.
          </li>
          <li>
            Entre como médico:{" "}
            <code className="text-[var(--gold-light)]">carlos@meurim.com</code> /{" "}
            <code className="text-[var(--gold-light)]">medico123</code>
          </li>
          <li>No painel, abra a sala da consulta paga.</li>
          <li>
            Veja o e-mail simulado no terminal onde rodou <code>npm run dev</code>.
          </li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/agendar?rapido=1" className="btn-gold">
            Testar como paciente
          </Link>
          <Link href="/medicos/login" className="btn-ghost">
            Testar como médico
          </Link>
        </div>
      </section>

      <p className="mt-10 text-sm text-[var(--text-muted)]">
        Variáveis de ambiente: copie <code>.env.example</code> para{" "}
        <code>.env.local</code> quando for à Vercel. Detalhes em{" "}
        <code>SETUP.md</code> no repositório.
      </p>
    </div>
  );
}
