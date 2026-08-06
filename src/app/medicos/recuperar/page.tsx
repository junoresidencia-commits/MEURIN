import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="text-sm font-semibold text-[var(--gold)]">Área do médico</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold text-[var(--text)]">
        Recuperar acesso
      </h1>
      <div className="panel mt-8 space-y-4 text-sm text-[var(--text-soft)]">
        <p>
          Para redefinir sua senha, fale com o administrador do Meu Rim. Em breve
          a redefinição por e-mail estará disponível.
        </p>
        <a
          href="https://wa.me/5573999052933?text=Preciso%20recuperar%20o%20acesso%20de%20m%C3%A9dico%20no%20Meu%20Rim"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold w-full"
        >
          Falar no WhatsApp
        </a>
        <Link href="/medicos/login" className="btn-ghost w-full">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
