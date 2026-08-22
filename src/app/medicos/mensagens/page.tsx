"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";

type Row = { key: string; name: string; city: string; phone: string; cpf: string | null; isCreated: boolean; lastSlot: string };

export default function MensagensPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchRows(query: string) {
    setLoading(true);
    fetch(`/api/doctor/patients/search?q=${encodeURIComponent(query)}`)
      .then((r) => { if (r.status === 401) { router.replace("/medicos/login"); return null; } return r.ok ? r.json() : { patients: [] }; })
      .then((d) => { if (d) setRows(d.patients || []); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchRows(q), 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function whats(r: Row) {
    const digits = (r.phone || "").replace(/\D/g, "");
    const withCountry = digits.length >= 12 ? digits : digits ? `55${digits}` : "";
    const msg = `Olá, ${r.name}! Aqui é do consultório (Meu Rim).`;
    const url = withCountry ? `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 pb-28 pt-8 lg:pb-8">
          <Link href="/medicos/painel" className="text-sm font-semibold text-[var(--gold)]">← Painel</Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">Mensagens</h1>
            <Link href="/notificacoes" className="btn-ghost text-sm">Notificações do app</Link>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Fale com seus pacientes pelo WhatsApp. As mensagens saem do seu WhatsApp — evite enviar dados clínicos sensíveis.</p>

          <div className="mt-4">
            <input className="input-field" placeholder="Buscar paciente por nome, CPF ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{q ? "Resultados" : "Pacientes recentes"}</p>
          {loading && <p className="mt-2 text-sm text-[var(--text-muted)]">Buscando…</p>}
          {!loading && rows.length === 0 && <p className="mt-2 text-sm text-[var(--text-muted)]">{q ? "Nenhum paciente encontrado." : "Nenhum paciente recente."}</p>}

          <ul className="mt-2 space-y-2">
            {rows.map((r) => {
              const hasPhone = (r.phone || "").replace(/\D/g, "").length >= 10;
              return (
                <li key={r.key} className="panel !p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-xs font-bold text-[var(--gold)]">{r.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text)]">{r.name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{hasPhone ? r.phone : "Sem telefone cadastrado"}{r.city ? ` · ${r.city}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {hasPhone ? (
                        <button type="button" className="btn-gold text-sm" onClick={() => whats(r)}>WhatsApp</button>
                      ) : (
                        <Link href={`/medicos/paciente/${encodeURIComponent(r.key)}`} className="btn-ghost text-sm">Abrir</Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <DoctorMobileNav />
    </div>
  );
}
