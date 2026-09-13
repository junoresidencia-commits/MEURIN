"use client";

import Link from "next/link";

export default function PlataformaHomePage() {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--gold)]">Administração Meu Rim</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Administração da plataforma</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
        Esta área é separada do seu trabalho médico. Agenda, pacientes e prontuário continuam em
        <Link href="/medicos/painel" className="font-semibold text-[var(--gold)]"> Área médica</Link>.
        Nada aqui move pacientes nem altera o seu login.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/plataforma/clinicas" className="panel block">
          <p className="font-bold">Clínicas</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastro, gestora e gestão. Sem vínculo automático dos pacientes atuais.</p>
        </Link>
        <Link href="/plataforma/usuarios" className="panel block">
          <p className="font-bold">Usuários</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Médicos existentes e papéis. Somente leitura de senha/ID.</p>
        </Link>
        <Link href="/plataforma/integridade" className="panel block">
          <p className="font-bold">Integridade</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Contagens de pacientes, médicos, consultas, evoluções e exames.</p>
        </Link>
      </div>
    </div>
  );
}
