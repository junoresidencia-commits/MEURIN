"use client";

type Snapshot = {
  identification: { name: string; age: number | null; sex: string | null; allergies: string | null };
  anthropometry: { pesoKg: unknown; alturaCm: unknown; imc: unknown };
  renal: { drc: unknown; estagioG: unknown; categoriaA: unknown; etiologia: unknown; hemodialise: unknown; dialisePeritoneal: unknown };
  comorbidities: { has: unknown; dm: unknown; ic: unknown; dcv: unknown };
  medications: string;
  vitals: { pa: string | null; fc: unknown; glicemia: unknown };
  labs: { key: string; label: string; value: number; unit?: string; measuredAt: string }[];
};

function val(v: unknown) {
  if (v == null || v === "") return "—";
  return String(v);
}

export function ClinicalSnapshotCard({ snapshot, showLabs }: { snapshot: Snapshot; showLabs: boolean }) {
  return (
    <div className="space-y-3">
      <div className="panel grid gap-2 sm:grid-cols-2">
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Identificação</span><br />{snapshot.identification.name || "—"}{snapshot.identification.age != null ? ` · ${snapshot.identification.age} anos` : ""}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Sexo</span><br />{val(snapshot.identification.sex)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Peso / altura / IMC</span><br />{val(snapshot.anthropometry.pesoKg)} kg · {val(snapshot.anthropometry.alturaCm)} cm · IMC {val(snapshot.anthropometry.imc)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Alergias</span><br />{val(snapshot.identification.allergies)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Diagnóstico renal</span><br />DRC {val(snapshot.renal.drc)} · G{val(snapshot.renal.estagioG)} A{val(snapshot.renal.categoriaA)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Etiologia</span><br />{val(snapshot.renal.etiologia)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Comorbidades</span><br />HAS {val(snapshot.comorbidities.has)} · DM {val(snapshot.comorbidities.dm)}</p>
        <p><span className="text-xs font-semibold text-[var(--text-muted)]">Sinais</span><br />PA {val(snapshot.vitals.pa)} · FC {val(snapshot.vitals.fc)} · glicemia {val(snapshot.vitals.glicemia)}</p>
      </div>
      <div className="panel">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Medicamentos</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-soft)]">{snapshot.medications || "—"}</p>
      </div>
      {showLabs && (
        <div className="panel">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Exames pertinentes</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {snapshot.labs.length === 0 && <p className="col-span-2 text-sm text-[var(--text-muted)]">Sem exames pertinentes.</p>}
            {snapshot.labs.map((l) => (
              <div key={l.key} className="rounded-xl border border-[var(--border)] p-2">
                <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{l.label}</p>
                <p className="text-sm font-bold">{l.value} {l.unit || ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
