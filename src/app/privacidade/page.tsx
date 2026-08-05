import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Legal</p>
      <h1 className="font-display mt-2 text-4xl text-[var(--text)]">Privacidade</h1>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-[var(--text-soft)]">
        <p>
          Tratamos dados de saúde e identificação para agendar, cobrar e
          realizar a teleconsulta (nome, e-mail, telefone, cidade, motivo,
          horários e registros de pagamento).
        </p>
        <p>
          Em demonstração, os dados ficam em armazenamento local do servidor
          (<code>data/db.json</code>). Em produção, use banco com criptografia,
          acesso restrito e políticas LGPD.
        </p>
        <p>
          Não vendemos dados. Compartilhamos com o médico da consulta e com
          processadores de pagamento/e-mail necessários ao serviço.
        </p>
        <p>
          Para exclusão ou acesso aos seus dados, contate o responsável pela
          plataforma (e-mail da PJ). Revise este texto com advogado LGPD antes
          do go-live.
        </p>
      </div>
      <Link href="/" className="btn-ghost mt-10 inline-flex">
        Voltar
      </Link>
    </div>
  );
}
