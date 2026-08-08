"use client";

import Link from "next/link";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { RESEARCH_VARS, RESEARCH_GROUPS } from "@/lib/research-fields";

const TYPE_LABEL: Record<string, string> = { num: "Numérico", cat: "Categórico", text: "Texto" };

export default function DicionarioPage() {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/pesquisa" className="text-sm font-semibold text-[var(--gold)]">← Pesquisa</Link>
          <h1 className="font-display mt-3 text-3xl font-extrabold text-[var(--text)]">Dicionário de dados</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Definição de cada variável para padronizar o registro e a pesquisa. Valores categóricos
            usam sempre as mesmas opções; ausência de dado significa <b>desconhecido</b>.
          </p>

          {RESEARCH_GROUPS.map((g) => (
            <section key={g} className="mt-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--gold-light)]">{g}</h2>
              <div className="grid gap-2">
                {RESEARCH_VARS.filter((v) => v.group === g).map((v) => (
                  <div key={v.key} className="panel">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-[var(--text)]">{v.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{TYPE_LABEL[v.type]}{v.unit ? ` · ${v.unit}` : ""} · origem: {v.source}</p>
                    </div>
                    {v.options && (
                      <p className="mt-1 text-xs text-[var(--text-soft)]">Valores: {v.options.map((o) => o.label).join(" · ")}</p>
                    )}
                    {v.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{v.description}</p>}
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">chave: <code>{v.key}</code></p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
