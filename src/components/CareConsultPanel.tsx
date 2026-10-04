"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ClinicalSnapshotCard } from "@/components/ClinicalSnapshotCard";
import { toFriendlyMessage } from "@/lib/user-errors";

type Kind = "psychology" | "nursing" | "nutrition";

export const CareConsultPanel = memo(function CareConsultPanel({ kind, patientKey }: { kind: Kind; patientKey: string }) {
  const [snapshot, setSnapshot] = useState<Parameters<typeof ClinicalSnapshotCard>[0]["snapshot"] | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [share, setShare] = useState(kind !== "psychology");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const noteId = useRef<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  const lock = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const url = kind === "nutrition"
      ? `/api/nutricionista/patients/${encodeURIComponent(patientKey)}`
      : `/api/allied/patients/${encodeURIComponent(patientKey)}`;
    fetch(url)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não foi possível abrir o prontuário.");
        if (kind === "nutrition") {
          const labs = (d.labs || []).map((l: { key: string; label: string; value: number; unit?: string; measuredAt: string }) => l);
          setSnapshot({
            identification: { name: d.patient?.name || "", age: null, sex: d.patient?.sex || null, allergies: null },
            anthropometry: {
              pesoKg: d.renal?.pesoKg ?? null,
              alturaCm: d.renal?.alturaCm ?? null,
              imc: d.renal?.imc ?? null,
            },
            renal: {
              drc: d.renal?.drc ?? null,
              estagioG: d.renal?.estagioG ?? null,
              categoriaA: d.renal?.categoriaA ?? null,
              etiologia: d.renal?.etiologia ?? null,
              hemodialise: null,
              dialisePeritoneal: null,
            },
            comorbidities: { has: null, dm: null, ic: null, dcv: null },
            medications: "",
            vitals: { pa: null, fc: null, glicemia: null },
            labs,
          });
        } else {
          setSnapshot(d.snapshot);
        }
      })
      .catch((e) => setError(toFriendlyMessage(e, "Não foi possível abrir o prontuário.")));
  }, [kind, patientKey]);

  const persist = useCallback(async () => {
    const body = textRef.current.trim();
    if (!body) return;
    if (lock.current) {
      dirty.current = true;
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      if (kind === "nutrition") {
        const res = await fetch(`/api/nutricionista/patients/${encodeURIComponent(patientKey)}/consulta`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessment: { conduta: body },
            plan: {},
            shareWithPatient: share,
            generatePlanPdf: false,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
        setMsg("Evolução salva no prontuário nutricional.");
      } else {
        const res = await fetch(`/api/allied/patients/${encodeURIComponent(patientKey)}/notes`, {
          method: noteId.current ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: noteId.current || undefined,
            kind: "evolucao",
            title: "Evolução — consulta online",
            body,
            shareWithTeam: share,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
        if (d.note?.id) noteId.current = d.note.id;
        setMsg("Evolução salva no prontuário.");
      }
    } catch (e) {
      setMsg(toFriendlyMessage(e, "Não foi possível salvar a evolução."));
    } finally {
      lock.current = false;
      setSaving(false);
      if (dirty.current) {
        dirty.current = false;
        void persist();
      }
    }
  }, [kind, patientKey, share]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (textRef.current.trim()) void persist();
    }, 1200);
    return () => clearTimeout(t);
  }, [text, persist]);

  return (
    <div className="space-y-3">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Prontuário na consulta</p>
        <p className="text-sm text-[var(--text-soft)]">
          Escreva a evolução enquanto atende. Salva sozinho no prontuário da equipe.
        </p>
        <textarea
          className="input-field min-h-[160px] text-sm"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMsg("");
          }}
          placeholder="O que o paciente relata, conduta, orientação…"
        />
        {kind === "psychology" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
            Compartilhar com a equipe
          </label>
        )}
        <button type="button" className="btn-ghost !min-h-[40px] !text-xs" onClick={() => void persist()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar agora"}
        </button>
        {msg && <p className="text-xs text-[var(--text-muted)]">{msg}</p>}
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {snapshot && <ClinicalSnapshotCard snapshot={snapshot} showLabs={kind !== "psychology"} />}
    </div>
  );
});
