"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  users: "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9",
  cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8ZM14 3v5h5",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  chart: "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  heart: "M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 4 4.8 7.4 8.8 10.4 4-3 8.8-6.4 8.8-10.4Z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.3-2.5H9.9l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.5h4.2l.3-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z",
};

function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const PRIMARY: { href: string; label: string; icon: keyof typeof PATHS }[] = [
  { href: "/medicos/painel", label: "Painel", icon: "home" },
  { href: "/medicos/pacientes", label: "Pacientes", icon: "users" },
  { href: "/medicos/agenda", label: "Agenda", icon: "cal" },
  { href: "/medicos/atendimentos", label: "Atendimentos", icon: "file" },
  { href: "/medicos/retornos", label: "Retornos", icon: "file" },
  { href: "/medicos/links", label: "Links", icon: "link" },
];
const MORE: { href: string; label: string; icon: keyof typeof PATHS }[] = [
  { href: "/medicos/lme", label: "Documentos / LME", icon: "file" },
  { href: "/medicos/mensagens", label: "Mensagens", icon: "link" },
  { href: "/medicos/equipe-assistencial", label: "Minha Equipe", icon: "heart" },
  { href: "/medicos/encaminhamentos", label: "Encaminhamentos", icon: "users" },
  { href: "/medicos/equipe-nutricao", label: "Nutrição", icon: "heart" },
  { href: "/medicos/painel#financeiro", label: "Financeiro", icon: "chart" },
  { href: "/medicos/pesquisa", label: "Estudos e Pesquisa", icon: "chart" },
  { href: "/medicos/documentos", label: "Documentos avulsos", icon: "edit" },
  { href: "/medicos/agenda/configurar", label: "Clínicas e horários", icon: "cal" },
  { href: "/medicos/equipe", label: "Atendentes", icon: "users" },
  { href: "/medicos/configuracoes", label: "Configurações", icon: "gear" },
];

export function DoctorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [doctor, setDoctor] = useState<{ name?: string; crm?: string; specialty?: string; logoUrl?: string; photoUrl?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => { if (d?.doctor) setDoctor(d.doctor); }).catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/medicos/login");
  }

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return pathname === base || (base !== "/medicos/painel" && pathname.startsWith(base + "/"));
  };
  const itemCls = (href: string) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
      isActive(href) ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-[var(--text-soft)] hover:bg-[var(--gold-soft)] hover:text-[var(--gold)]"
    }`;

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-white lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-4">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-sm font-extrabold text-white">MR</span>
          <span className="font-display text-lg font-extrabold text-[var(--text)]">Meu <span className="text-[var(--gold)]">Rim</span></span>
        </Link>

        {doctor && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3">
            {doctor.photoUrl || doctor.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doctor.photoUrl || doctor.logoUrl} alt="Foto" className="h-10 w-10 shrink-0 rounded-full border border-[var(--border)] object-cover" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">{(doctor.name || "Dr").slice(0, 2).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--text)]">{doctor.name || "Médico"}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">{[doctor.crm, doctor.specialty].filter(Boolean).join(" · ") || "Perfil"}</p>
            </div>
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {PRIMARY.map(({ href, label, icon }) => (
            <Link key={label} href={href} className={itemCls(href)}>
              <Icon name={icon} className="h-5 w-5" />
              {label}
            </Link>
          ))}
          <p className="mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Mais</p>
          {MORE.map(({ href, label, icon }) => (
            <Link key={label} href={href} className={itemCls(href)}>
              <Icon name={icon} className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <a href="https://wa.me/?text=Preciso%20de%20ajuda%20no%20Meu%20Rim" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-[var(--gold-soft)] hover:text-[var(--gold)]">
            <Icon name="heart" className="h-5 w-5" /> Suporte
          </a>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--danger)]">
            <Icon name="link" className="h-5 w-5" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
