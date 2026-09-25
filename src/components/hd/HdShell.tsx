"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { HD_NAV, HD_SHIFT_LABEL, monthLabel } from "@/lib/hd-labels";
import type { HdPermKey, HdShift } from "@/lib/hd-types";

export type HdSession = {
  allowed: boolean;
  unit?: { id: string; name: string };
  member?: { id: string; name: string; role: string; status: string };
  perms?: Record<HdPermKey, boolean>;
  doctor?: { name: string; email?: string };
};

type HdUi = {
  session: HdSession | null;
  year: number;
  month: number;
  shift: HdShift | "ALL";
  q: string;
  setYear: (n: number) => void;
  setMonth: (n: number) => void;
  setShift: (s: HdShift | "ALL") => void;
  setQ: (s: string) => void;
  can: (k: HdPermKey) => boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<HdUi | null>(null);

export function useHd() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHd");
  return v;
}

function nowYm() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function HdShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const initial = nowYm();
  const [session, setSession] = useState<HdSession | null>(null);
  const [year, setYear] = useState(Number(sp.get("year")) || initial.year);
  const [month, setMonth] = useState(Number(sp.get("month")) || initial.month);
  const [shift, setShift] = useState<HdShift | "ALL">((sp.get("shift") as HdShift) || "ALL");
  const [q, setQ] = useState(sp.get("q") || "");

  const reload = useCallback(async () => {
    const r = await fetch("/api/hemodialise?view=session&bootstrap=1");
    const d = await r.json();
    if (r.status === 401 || !d.allowed) {
      if (r.status === 401) router.replace("/medicos/login");
      else setSession({ allowed: false });
      return;
    }
    setSession(d);
  }, [router]);

  useEffect(() => {
    reload().catch(() => setSession({ allowed: false }));
  }, [reload]);

  const can = useCallback(
    (k: HdPermKey) => Boolean(session?.perms?.[k]),
    [session]
  );

  const value = useMemo<HdUi>(
    () => ({ session, year, month, shift, q, setYear, setMonth, setShift, setQ, can, reload }),
    [session, year, month, shift, q, can, reload]
  );

  const nav = HD_NAV.filter((item) => {
    if (item.href.includes("/mapa") && session?.perms && !session.perms.view_map) return false;
    if (item.href.includes("/revisao") && session?.perms && !session.perms.review) return false;
    if (item.href.includes("/equipe") && session?.perms && !session.perms.manage_team) return false;
    if (item.href.includes("/historico") && session?.perms && !session.perms.view_history) return false;
    if (item.href.includes("/configuracoes") && session?.perms && !session.perms.manage_config) return false;
    return true;
  });

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-screen bg-[var(--bg)]">
        <DoctorSidebar />
        <div className="min-w-0 flex-1">
          <div className="border-b border-[var(--border)] bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Hemodiálise</p>
                <h1 className="font-display text-2xl font-extrabold text-[var(--text)]">
                  {session?.unit?.name || "Módulo"}
                </h1>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{monthLabel(year, i + 1).split(" ")[0]}</option>
                  ))}
                </select>
                <select className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {[year - 1, year, year + 1].filter((y, i, a) => a.indexOf(y) === i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <div className="flex rounded-xl border border-[var(--border)] p-0.5">
                  {(["ALL", "MANHA", "TARDE", "NOITE"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShift(s)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${shift === s ? "bg-[var(--gold)] text-white" : "text-[var(--text-soft)]"}`}
                    >
                      {s === "ALL" ? "Todos" : HD_SHIFT_LABEL[s]}
                    </button>
                  ))}
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Busca"
                  className="w-40 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-3">
              {nav.map((item) => {
                const active = pathname === item.href || (item.href !== "/hemodialise/inicio" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${
                      active ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-[var(--text-muted)] hover:text-[var(--gold)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mx-auto max-w-7xl px-5 py-6 pb-28 lg:pb-10">
            {session == null && <p className="text-[var(--text-muted)]">Carregando…</p>}
            {session?.allowed === false && (
              <div className="panel">
                <p className="font-display text-xl font-bold">Sem acesso à Hemodiálise</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">Peça ao administrador do módulo para incluir você na equipe.</p>
                <Link href="/medicos/painel" className="btn-ghost mt-4 inline-flex">Voltar ao Meu Rim</Link>
              </div>
            )}
            {session?.allowed && children}
          </div>
        </div>
        <DoctorMobileNav />
      </div>
    </Ctx.Provider>
  );
}
