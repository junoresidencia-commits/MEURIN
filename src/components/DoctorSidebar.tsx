"use client";

import Link from "next/link";

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  users: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8ZM14 3v5h5",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  chart: "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.3-2.5H9.9l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.5h4.2l.3-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z",
};

function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const ITEMS: { href: string; label: string; icon: keyof typeof PATHS }[] = [
  { href: "/medicos/painel", label: "Painel inicial", icon: "home" },
  { href: "/medicos/painel#pacientes", label: "Pacientes", icon: "users" },
  { href: "/medicos/painel#agenda", label: "Agenda", icon: "cal" },
  { href: "/medicos/agenda", label: "Locais e horários", icon: "cal" },
  { href: "/medicos/painel#pacientes", label: "Prontuários", icon: "file" },
  { href: "/medicos/documentos", label: "Documento avulso", icon: "edit" },
  { href: "/medicos/configuracoes/documentos", label: "Papéis timbrados", icon: "file" },
  { href: "/medicos/pesquisa", label: "Pesquisa", icon: "chart" },
  { href: "/medicos/links", label: "Links úteis", icon: "link" },
  { href: "/medicos/configuracoes", label: "Configurações", icon: "gear" },
  { href: "/admin/login", label: "Administração", icon: "shield" },
];

export function DoctorSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-sm font-extrabold text-white">MR</span>
          <span className="font-display text-lg font-extrabold text-[var(--text)]">Meu <span className="text-[var(--gold)]">Rim</span></span>
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-[var(--gold-soft)] hover:text-[var(--gold)]"
            >
              <Icon name={icon} className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
