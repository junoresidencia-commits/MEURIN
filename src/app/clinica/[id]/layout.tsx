"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "", label: "Visão" },
  { href: "/equipe", label: "Equipe" },
  { href: "/financeiro", label: "Produção" },
  { href: "/caixa", label: "Check-in" },
];

export default function ClinicaLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [canAdmin, setCanAdmin] = useState(false);
  const [home, setHome] = useState("/medicos/painel");

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/me`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.clinic) {
          router.replace("/");
          return;
        }
        setClinic(d.clinic.name);
        setName(d.staff.name);
        setCanAdmin(Boolean(d.staff.canAdmin));
        setHome(d.staff.kind === "attendant" ? "/atendente/painel" : "/medicos/painel");
        setReady(true);
      })
      .catch(() => router.replace("/"));
  }, [params.id, router]);

  if (!ready) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando clínica…</div>;
  }

  const items = NAV.filter((n) => canAdmin || n.href === "/caixa" || n.href === "");

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--gold)]">Gestão da clínica</p>
          <p className="mt-1 px-2 text-sm font-bold text-[var(--text)]">{clinic}</p>
          <p className="px-2 text-[11px] text-[var(--text-muted)]">{name} · separado da área médica</p>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {items.map((n) => {
              const href = `/clinica/${params.id}${n.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    active ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-[var(--text-soft)] hover:bg-[var(--gold-soft)]"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link href={home} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--gold)]">
            ← Voltar
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="border-b border-[var(--border)] bg-white px-5 py-3 lg:hidden">
          <Link href={home} className="text-sm font-semibold text-[var(--gold)]">← Voltar</Link>
          <p className="mt-1 font-bold">{clinic}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((n) => (
              <Link key={n.href} href={`/clinica/${params.id}${n.href}`} className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-5 py-8">{children}</div>
      </div>
    </div>
  );
}
