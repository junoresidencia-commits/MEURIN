"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IntelPrefsForm } from "@/components/IntelPrefsForm";
import { DEFAULT_INTEL_PREFS, type IntelligencePrefs } from "@/lib/intelligence-prefs";

export default function ClinicaInteligenciaPage() {
  const params = useParams<{ id: string }>();
  const [prefs, setPrefs] = useState<IntelligencePrefs>(DEFAULT_INTEL_PREFS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/clinica/${params.id}/intelligence`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.prefs) setPrefs({ ...DEFAULT_INTEL_PREFS, ...d.prefs, applyMode: "review_only" });
      })
      .catch(() => {});
  }, [params.id]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/clinica/${params.id}/intelligence`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Não foi possível salvar.");
      if (d.prefs) setPrefs({ ...DEFAULT_INTEL_PREFS, ...d.prefs, applyMode: "review_only" });
      setMsg("Padrão da clínica salvo. Cada médico ainda confirma o que entra no perfil.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-[var(--text)]">Inteligência clínica</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Padrão da clínica. Não aplica sozinha e não mexe em paciente antigo. O médico pode ajustar na área dele.
      </p>
      <div className="mt-5">
        <IntelPrefsForm prefs={prefs} onChange={setPrefs} saving={saving} onSave={save} msg={msg} />
      </div>
    </div>
  );
}
