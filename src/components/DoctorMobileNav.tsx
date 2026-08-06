"use client";

import Link from "next/link";

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  users: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z",
};

function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const ITEMS: { href: string; label: string; icon: keyof typeof PATHS }[] = [
  { href: "/medicos/painel", label: "Painel", icon: "home" },
  { href: "/medicos/painel#pacientes", label: "Pacientes", icon: "users" },
  { href: "/medicos/painel#agenda", label: "Agenda", icon: "cal" },
  { href: "/admin/login", label: "Admin", icon: "shield" },
];

/** Navegação inferior do médico — só no celular (no desktop usamos o menu lateral). */
export function DoctorMobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-[var(--border)] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon }) => (
          <Link key={label} href={href} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
            <Icon name={icon} className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
