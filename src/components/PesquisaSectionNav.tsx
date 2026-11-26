"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/medicos/pesquisa/estudos", label: "Estudos" },
  { href: "/medicos/pesquisa/primeira-consulta", label: "Primeira Consulta" },
];

export function PesquisaSectionNav() {
  const path = usePathname() || "";
  const onFirst = path.startsWith("/medicos/pesquisa/primeira-consulta");
  const onEstudos = !onFirst && (path === "/medicos/pesquisa" || path.startsWith("/medicos/pesquisa/estudos") || path.startsWith("/medicos/pesquisa/casos") || path.startsWith("/medicos/pesquisa/coorte") || path.startsWith("/medicos/pesquisa/ideias") || path.startsWith("/medicos/pesquisa/dicionario"));

  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-[var(--border)] bg-white p-1">
      {TABS.map((t) => {
        const on = t.href.includes("primeira-consulta") ? onFirst : onEstudos;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${on ? "bg-[var(--gold)] text-white" : "text-[var(--text-soft)] hover:bg-[var(--gold-soft)]"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
