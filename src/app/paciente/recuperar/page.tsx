"use client";

import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <Link href="/paciente/entrar" className="text-sm font-semibold text-[var(--gold)]">← Voltar ao login</Link>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Esqueci minha senha</h1>
      <div className="panel mt-6 space-y-3 text-sm text-[var(--text-soft)]">
        <p>Por segurança, a redefinição de senha do paciente é feita pela sua equipe.</p>
        <p>
          Entre em contato com o seu <b>médico</b> ou a <b>atendente</b> e peça para <b>redefinir seu acesso</b>.
          Eles vão restaurar a senha provisória <b>123456</b>.
        </p>
        <p>
          Depois, entre com seu <b>CPF</b> e a senha <b>123456</b> — o sistema pedirá para você criar uma nova senha pessoal.
        </p>
        <Link href="/paciente/entrar" className="btn-gold mt-2 inline-block">Voltar ao login</Link>
      </div>
    </div>
  );
}
