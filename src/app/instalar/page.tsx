"use client";

import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";

export default function InstalarPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Aplicativo</p>
      <h1 className="font-display mt-2 text-4xl font-extrabold text-[var(--text)]">
        Instalar o Meu Rim
      </h1>
      <p className="mt-4 text-[var(--text-soft)]">
        No celular vira PWA (ícone na tela inicial). No Mac, vai para o Dock — ou você baixa o <b>Meu Rim.app</b>.
      </p>

      <section className="panel mt-8 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Celular — PWA</p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Tela de início</h2>
        <div className="space-y-3 text-[var(--text-soft)]">
          <p>
            <b>iPhone (Safari):</b> toque em Compartilhar → <b>Adicionar à Tela de Início</b> → Adicionar. Abra pelo ícone Meu Rim.
          </p>
          <p>
            <b>Android (Chrome):</b> menu <b>⋮</b> → <b>Instalar aplicativo</b>, ou o botão abaixo se aparecer.
          </p>
        </div>
        <InstallAppButton className="btn-gold w-full sm:w-auto" label="Instalar aplicativo" hideIfNoPrompt />
      </section>

      <section className="panel mt-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Mac — Safari</p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)]">Adicionar ao Dock</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--text-soft)]">
          <li>Abra o Meu Rim no <b>Safari</b> (macOS Sonoma 14 ou mais novo).</li>
          <li>Menu <b>Arquivo</b> → <b>Adicionar ao Dock…</b></li>
          <li>Confirme o nome <b>Meu Rim</b> e clique em <b>Adicionar</b>.</li>
        </ol>
        <p className="text-sm text-[var(--text-muted)]">
          O ícone fica no Dock e em <b>Finder → Aplicativos → Aplicativos da Web</b>. Para remover: botão direito no ícone → Remover do Dock.
        </p>
      </section>

      <section className="panel mt-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Mac — baixar</p>
        <h2 className="font-display text-xl font-extrabold text-[var(--text)]">Meu Rim.app</h2>
        <p className="text-[var(--text-soft)]">
          Baixe o ZIP, extraia e arraste <b>Meu Rim.app</b> para Aplicativos. Na primeira vez: botão direito → <b>Abrir</b> (o Mac avisa porque não veio da App Store).
        </p>
        <a href="/downloads/Meu-Rim-Mac.zip" className="btn-gold inline-flex" download>
          Baixar Meu Rim para Mac
        </a>
        <p className="text-sm text-[var(--text-muted)]">
          O atalho abre o Meu Rim em janela de app. O modo nativo do Mac continua sendo Adicionar ao Dock, acima.
        </p>
      </section>

      <Link href="/" className="btn-ghost mt-8 inline-flex">
        Voltar
      </Link>
    </div>
  );
}
