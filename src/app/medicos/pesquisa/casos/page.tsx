"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { CASE_CATEGORY_LABEL } from "../studyMeta";

type CaseItem = {
  id: string;
  patientKey: string;
  patientName: string;
  categories: string[];
  note?: string | null;
  updatedAt: string;
};

function patientHref(patientKey: string): string {
  const id = patientKey.startsWith("pid:") ? patientKey.slice(4) : patientKey;
  return `/medicos/paciente/${encodeURIComponent(id)}`;
}

export default function CasosPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => {
      if (!d.doctor) { router.replace("/medicos/login"); return; }
      setReady(true);
      fetch("/api/pesquisa/cases").then((r) => r.json()).then((x) => setCases(x.cases || [])).catch(() => {});
    });
  }, [router]);

  if (!ready) return <div className="mx-auto max-w-4xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 lg:pb-8">
          <p className="text-sm font-semibold text-[var(--gold)]"><Link href="/medicos/pesquisa" className="hover:underline">Pesquisa Científica</Link> › Casos</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold text-[var(--text)]">Casos interessantes</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Pacientes que você marcou para estudo. As anotações científicas são privadas (não aparecem ao paciente).</p>

          {cases.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--text-muted)]">
              Nenhum caso marcado ainda. No prontuário de um paciente, abra a aba <b>Pesquisa</b> e clique em <b>⭐ Marcar caso interessante</b>.
            </p>
          ) : (
            <div className="mt-6 grid gap-3">
              {cases.map((c) => (
                <div key={c.id} className="panel">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--text)]">{c.patientName || "Paciente"}</p>
                    <Link href={patientHref(c.patientKey)} className="text-sm text-[var(--gold)]">Abrir prontuário →</Link>
                  </div>
                  {c.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.categories.map((cat) => (
                        <span key={cat} className="rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--gold)]">
                          {CASE_CATEGORY_LABEL[cat] || cat}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.note && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-soft)]">{c.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
