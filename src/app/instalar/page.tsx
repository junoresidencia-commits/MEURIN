"use client";

import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";

export default function InstalarPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Aplicativo</p>
      <h1 className="font-display mt-2 text-4xl font-extrabold text-[var(--text)]">
        Meu Rim no seu Mac
      </h1>
      <p className="mt-4 text-[var(--text-soft)]">
        Você já está no site certo. No Mac, o Meu Rim vira um aplicativo no Dock — janela própria, sem a barra do Safari.
      </p>

      <section className="panel mt-8 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Recomendado no Safari</p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Adicionar ao Dock</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--text-soft)]">
          <li>Deixe esta página aberta no <b>Safari</b> (macOS Sonoma 14 ou mais novo).</li>
          <li>No menu de cima, clique em <b>Arquivo</b>.</li>
          <li>Escolha <b>Adicionar ao Dock…</b></li>
          <li>Confirme o nome <b>Meu Rim</b> e clique em <b>Adicionar</b>.</li>
        </ol>
        <p className="text-sm text-[var(--text-muted)]">
          O ícone aparece no Dock e também em <b>Finder → Aplicativos → Aplicativos da Web</b>. Clique nele como qualquer app. Para tirar: clique com o botão direito no ícone → Remover do Dock.
        </p>
      </section>

      <section className="panel mt-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Chrome ou Edge</p>
        <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Instalar aplicativo</h2>
        <p className="text-[var(--text-soft)]">
          No Chrome, abra o menu <b>⋮</b> → <b>Instalar Meu Rim…</b> (ou use o botão abaixo, se o navegador oferecer).
        </p>
        <InstallAppButton className="btn-gold w-full sm:w-auto" label="Instalar aplicativo" hideIfNoPrompt />
      </section>

      <section className="panel mt-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Atalho para baixar</p>
        <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Meu Rim.app</h2>
        <p className="text-[var(--text-soft)]">
          Baixe o atalho, abra o ZIP e arraste <b>Meu Rim.app</b> para a pasta Aplicativos. Na primeira vez, clique com o botão direito → <b>Abrir</b> (o Mac avisa porque o atalho não é da App Store).
        </p>
        <a href="/downloads/Meu-Rim-Mac.zip" className="btn-gold inline-flex" download>
          Baixar Meu Rim para Mac
        </a>
        <p className="text-sm text-[var(--text-muted)]">
          O atalho abre o Meu Rim em janela de app (Chrome, se você tiver) ou no Safari. Preferir o modo nativo do Mac: use Adicionar ao Dock, acima.
        </p>
      </section>

      <p className="mt-8 text-sm text-[var(--text-muted)]">
        No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. No Android: Chrome → Instalar aplicativo.
      </p>
      <Link href="/" className="btn-ghost mt-6 inline-flex">
        Voltar
      </Link>
    </div>
  );
}
