"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DoctorSidebar } from "@/components/DoctorSidebar";
import { DoctorMobileNav } from "@/components/DoctorMobileNav";
import { GlobalPatientSearch } from "@/components/GlobalPatientSearch";
import { PatientQuickSheet } from "@/components/PatientQuickSheet";
import { CreatePatient } from "@/components/CreatePatient";

type LabVal = { value: number; unit: string | null; date: string } | null;
type Row = {
  key: string;
  name: string;
  photoUrl?: string | null;
  city: string;
  age: number | null;
  sex: string | null;
  drc: { flag: boolean; g: string | null; a: string | null };
  comorbidities: { has: boolean; dm: boolean };
  flags: { dialise: boolean; transplante: boolean; glomerulopatia: boolean; pediatria: boolean };
  labs: { tfge: LabVal; creatinina: LabVal; rac: LabVal; potassio: LabVal };
  alert: { level: "urgente" | "importante" | null; text: string | null; date: string | null };
  retornoPendente: boolean;
  active: boolean;
  isCreated: boolean;
  lastConsultation: string | null;
  nextConsultation: string | null;
};

type FilterId = "todos" | "ativos" | "drc" | "dialise" | "glomerulopatias" | "transplante" | "pediatria" | "retorno" | "alertas";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "drc", label: "DRC" },
  { id: "dialise", label: "Diálise" },
  { id: "glomerulopatias", label: "Glomerulopatias" },
  { id: "transplante", label: "Transplante" },
  { id: "pediatria", label: "Pediatria" },
  { id: "retorno", label: "Retorno pendente" },
  { id: "alertas", label: "Com alertas" },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const alertColor = { urgente: "#e86761", importante: "#e08a2e" } as const;
const alertEmoji = { urgente: "🔴", importante: "🟠" } as const;

function Lab({ label, lab }: { label: string; lab: LabVal }) {
  if (!lab) return null;
  return (
    <span className="inline-flex flex-col rounded-lg bg-[var(--gold-soft)] px-2 py-1 leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text)]">{lab.value}<span className="ml-0.5 text-[10px] font-normal text-[var(--text-muted)]">{fmtDate(lab.date)}</span></span>
    </span>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--border-gold)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--gold)]">{children}</span>;
}

function PacientesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("todos");
  const [quickKey, setQuickKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (searchParams.get("novo")) setShowCreate(true);
  }, [searchParams]);

  function load() {
    setError("");
    fetch("/api/doctor/patients/overview")
      .then((r) => {
        if (r.status === 401) { router.replace("/medicos/login"); return null; }
        return r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar os pacientes."));
      })
      .then((d) => { if (d) setRows(d.patients || []); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removePatient(key: string, name: string) {
    if (!window.confirm(`Excluir o paciente ${name}? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/doctor/patients", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: key }),
    });
    if (res.ok) setRows((rs) => (rs || []).filter((r) => r.key !== key));
    else window.alert("Não foi possível excluir o paciente.");
  }

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { todos: 0, ativos: 0, drc: 0, dialise: 0, glomerulopatias: 0, transplante: 0, pediatria: 0, retorno: 0, alertas: 0 };
    for (const r of rows || []) {
      c.todos++;
      if (r.active) c.ativos++;
      if (r.drc.flag) c.drc++;
      if (r.flags.dialise) c.dialise++;
      if (r.flags.glomerulopatia) c.glomerulopatias++;
      if (r.flags.transplante) c.transplante++;
      if (r.flags.pediatria) c.pediatria++;
      if (r.retornoPendente) c.retorno++;
      if (r.alert.level) c.alertas++;
    }
    return c;
  }, [rows]);

  const matchesFilter = (r: Row) => {
    switch (filter) {
      case "ativos": return r.active;
      case "drc": return r.drc.flag;
      case "dialise": return r.flags.dialise;
      case "glomerulopatias": return r.flags.glomerulopatia;
      case "transplante": return r.flags.transplante;
      case "pediatria": return r.flags.pediatria;
      case "retorno": return r.retornoPendente;
      case "alertas": return Boolean(r.alert.level);
      default: return true;
    }
  };
  const qn = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const visible = (rows || []).filter((r) => matchesFilter(r) && (!qn || r.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(qn)));
  // Busca-primeiro: sem busca e sem filtro específico NÃO despejamos a lista —
  // o médico procura o paciente (busca no topo) ou escolhe um filtro (grupos).
  const searching = qn !== "" || filter !== "todos";
  const list = searching ? visible : [];

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <DoctorSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-5 pb-28 pt-8 lg:pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-extrabold text-[var(--text)] sm:text-3xl">Pacientes</h1>
            <button type="button" className="btn-gold" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Fechar" : "+ Novo paciente"}</button>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Busque o paciente por nome, CPF ou telefone. Use os filtros para ver grupos (DRC, diálise, retornos, alertas).</p>

          {showCreate && <CreatePatient onCreated={() => { setShowCreate(false); load(); }} />}

          <div className="mt-4">
            <GlobalPatientSearch />
          </div>

          {/* Filtros rápidos — roláveis no mobile */}
          <div className="mt-4 -mx-5 overflow-x-auto px-5">
            <div className="flex w-max gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${filter === f.id ? "bg-[var(--gold)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-soft)] hover:border-[var(--border-gold)]"}`}
                >
                  {f.label}{rows ? <span className={`ml-1 ${filter === f.id ? "text-white/80" : "text-[var(--text-muted)]"}`}>{counts[f.id]}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {/* Busca local dentro do filtro */}
          <div className="mt-3">
            <input
              className="input-field"
              placeholder="Filtrar a lista por nome…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-[var(--danger)]/30 bg-[#fdecea] p-4 text-sm text-[var(--danger)]">
              {error} <button type="button" className="ml-2 font-semibold underline" onClick={load}>Tentar novamente</button>
            </div>
          )}

          {!rows && !error && (
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--gold-soft)]/60" />
              ))}
            </div>
          )}

          {rows && searching && (
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Resultados ({list.length})</p>
          )}

          {rows && !searching && !error && (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-gold)] bg-[var(--gold-soft)]/40 p-6 text-center">
              <p className="text-3xl">🔍</p>
              <p className="mt-2 font-display text-lg text-[var(--text)]">Encontre um paciente</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">Use a busca acima (nome, CPF ou telefone) ou escolha um filtro (DRC, diálise, retornos, alertas) para ver um grupo. Você tem <strong>{counts.todos}</strong> paciente{counts.todos === 1 ? "" : "s"}.</p>
            </div>
          )}

          {rows && searching && list.length === 0 && !error && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">Nenhum paciente encontrado. Ajuste a busca ou o filtro.</p>
          )}

          {rows && list.length > 0 && (
            <ul className="mt-2 space-y-3">
              {list.map((r) => (
                <li key={r.key} className="panel !p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-[var(--border)] object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--gold-soft)] text-sm font-bold text-[var(--gold)]">{r.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</span>
                      )}
                      <div className="min-w-0">
                      <button type="button" onClick={() => setQuickKey(r.key)} className="text-left">
                        <span className="font-display text-lg text-[var(--text)] hover:text-[var(--gold)]">{r.name}</span>
                        {r.age != null && <span className="ml-2 text-sm text-[var(--text-muted)]">{r.age} anos</span>}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {r.drc.flag && <Chip>DRC {r.drc.g || ""} {r.drc.a || ""}</Chip>}
                        {r.comorbidities.dm && <Chip>DM</Chip>}
                        {r.comorbidities.has && <Chip>HAS</Chip>}
                        {r.flags.dialise && <Chip>Diálise</Chip>}
                        {r.flags.transplante && <Chip>Transplante</Chip>}
                        {r.flags.glomerulopatia && <Chip>Glomerulopatia</Chip>}
                        {r.city && <span className="text-xs text-[var(--text-muted)]">{r.city}</span>}
                      </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.alert.level ? (
                        <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: alertColor[r.alert.level], borderColor: alertColor[r.alert.level], borderWidth: 1 }}>
                          {alertEmoji[r.alert.level]} {r.alert.text} <span className="font-normal text-[var(--text-muted)]">({fmtDate(r.alert.date)})</span>
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-xs font-semibold text-[var(--green)]">🟢 Sem alertas</span>
                      )}
                      {r.retornoPendente && <span className="whitespace-nowrap text-xs font-semibold text-[#e08a2e]">🟠 Retorno pendente</span>}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Lab label="TFGe" lab={r.labs.tfge} />
                    <Lab label="Creat." lab={r.labs.creatinina} />
                    <Lab label="RAC" lab={r.labs.rac} />
                    <Lab label="K" lab={r.labs.potassio} />
                    {!r.labs.tfge && !r.labs.creatinina && !r.labs.rac && !r.labs.potassio && (
                      <span className="text-xs text-[var(--text-muted)]">Sem exames cadastrados</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
                    <span>
                      {r.lastConsultation ? `Última consulta: ${fmtDate(r.lastConsultation)}` : "Sem consulta anterior"}
                      {r.nextConsultation ? ` · Próxima: ${fmtDate(r.nextConsultation)}` : ""}
                    </span>
                    <span className="flex gap-3">
                      <button type="button" className="font-semibold text-[var(--gold)]" onClick={() => setQuickKey(r.key)}>Resumo rápido</button>
                      <Link href={`/medicos/paciente/${encodeURIComponent(r.key)}`} className="font-semibold text-[var(--gold)]">Abrir prontuário →</Link>
                      {r.isCreated && (
                        <button type="button" className="font-semibold text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => removePatient(r.key, r.name)}>Excluir</button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <DoctorMobileNav />
      {quickKey && <PatientQuickSheet patientKey={quickKey} onClose={() => setQuickKey(null)} />}
    </div>
  );
}

export default function PacientesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-20 text-[var(--text-muted)]">Carregando…</div>}>
      <PacientesInner />
    </Suspense>
  );
}
