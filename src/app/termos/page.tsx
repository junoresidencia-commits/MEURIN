import Link from "next/link";

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Legal</p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">Termos de uso</h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-[var(--text-soft)]">
        <p>
          A Meu Rim é uma plataforma de teleconsulta de nefrologia. Conecta
          pacientes a médicos com CRM ativo para atendimento online eletivo.
        </p>
        <p>
          <strong className="text-[var(--text)]">Não é pronto-socorro.</strong> Em
          emergência (dor forte, falta de ar, desmaio, sangramento, anúria
          súbita), procure atendimento presencial imediato.
        </p>
        <p>
          O pagamento libera o acesso à sala. O valor da consulta é do médico
          escolhido; a plataforma pode reter taxa de serviço divulgada no
          checkout.
        </p>
        <p>
          Médicos são responsáveis pelo ato clínico, sigilo e cumprimento das
          normas do CFM/CRM. Pacientes devem informar dados verdadeiros.
        </p>
        <p>
          Este texto é um rascunho operacional para o lançamento. Substitua por
          revisão jurídica da sua PJ antes de cobrar em produção.
        </p>
      </div>
      <Link href="/" className="btn-ghost mt-10 inline-flex">
        Voltar
      </Link>
    </div>
  );
}
