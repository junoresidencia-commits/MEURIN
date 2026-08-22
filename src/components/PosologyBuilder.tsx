"use client";

import { useMemo, useState } from "react";

// Builder estruturado de posologia para a Receita. Não sugere dose pelo nome do
// medicamento — só monta o texto a partir do que o médico escolhe, e sugere a
// quantidade total (editável) conforme frequência × duração.

const UNITS = ["comprimido(s)", "cápsula(s)", "mL", "gota(s)", "mg", "aplicação(ões)", "sachê(s)", "ampola(s)"];
const VIAS = ["Oral", "Sublingual", "Subcutânea", "Intramuscular", "Endovenosa", "Tópica", "Inalatória", "Ocular", "Nasal", "Retal", "Outra"];
const FREQS: { id: string; label: string; perDay: number | null }[] = [
  { id: "1x", label: "1x ao dia", perDay: 1 },
  { id: "12h", label: "12/12h", perDay: 2 },
  { id: "8h", label: "8/8h", perDay: 3 },
  { id: "6h", label: "6/6h", perDay: 4 },
  { id: "2x", label: "2x ao dia", perDay: 2 },
  { id: "3x", label: "3x ao dia", perDay: 3 },
  { id: "sem3", label: "3x/semana", perDay: 3 / 7 },
  { id: "custom", label: "Personalizado", perDay: null },
];
const DURATIONS: { id: string; label: string; days: number | null }[] = [
  { id: "continuo", label: "Uso contínuo", days: 30 },
  { id: "7", label: "7 dias", days: 7 },
  { id: "10", label: "10 dias", days: 10 },
  { id: "14", label: "14 dias", days: 14 },
  { id: "30", label: "30 dias", days: 30 },
  { id: "90", label: "90 dias", days: 90 },
  { id: "custom", label: "Personalizado", days: null },
];

export function PosologyBuilder({ onAdd }: { onAdd: (text: string) => void }) {
  const [med, setMed] = useState("");
  const [apres, setApres] = useState("");
  const [dose, setDose] = useState("1");
  const [unit, setUnit] = useState(UNITS[0]);
  const [via, setVia] = useState("Oral");
  const [freq, setFreq] = useState("1x");
  const [freqCustom, setFreqCustom] = useState("");
  const [dur, setDur] = useState("continuo");
  const [durCustom, setDurCustom] = useState("");
  const [qty, setQty] = useState("");
  const [qtyEdited, setQtyEdited] = useState(false);
  const [orient, setOrient] = useState("");

  const freqLabel = freq === "custom" ? freqCustom : FREQS.find((f) => f.id === freq)?.label || "";
  const durLabel = dur === "custom" ? durCustom : DURATIONS.find((d) => d.id === dur)?.label || "";

  const suggestedQty = useMemo(() => {
    const perDay = FREQS.find((f) => f.id === freq)?.perDay ?? null;
    const days = DURATIONS.find((d) => d.id === dur)?.days ?? null;
    const doseN = Number(String(dose).replace(",", "."));
    if (perDay == null || days == null || !Number.isFinite(doseN) || doseN <= 0) return null;
    return Math.max(1, Math.ceil(perDay * days * doseN));
  }, [freq, dur, dose]);

  const effectiveQty = qtyEdited ? qty : (suggestedQty != null ? String(suggestedQty) : "");

  function add() {
    const lines: string[] = [];
    const nome = [med.trim(), apres.trim()].filter(Boolean).join(" ");
    if (nome) lines.push(nome);
    const posology = [`${dose} ${unit}`, `via ${via}`, freqLabel, durLabel].filter(Boolean).join(" — ");
    lines.push(posology);
    if (effectiveQty) lines.push(`Quantidade: ${effectiveQty} ${unit}`);
    if (orient.trim()) lines.push(`Orientações: ${orient.trim()}`);
    onAdd(lines.join("\n"));
    // limpa campos do medicamento para adicionar o próximo, mantém via/freq/duração
    setMed(""); setApres(""); setOrient(""); setQty(""); setQtyEdited(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">Montar posologia</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Medicamento</span>
          <input className="input-field" value={med} onChange={(e) => setMed(e.target.value)} placeholder="Ex.: Cinacalcete" /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Apresentação</span>
          <input className="input-field" value={apres} onChange={(e) => setApres(e.target.value)} placeholder="Ex.: 30 mg" /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Dose por tomada</span>
          <div className="flex gap-2">
            <input className="input-field w-20" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
            <select className="input-field" value={unit} onChange={(e) => setUnit(e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </div></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Via</span>
          <select className="input-field" value={via} onChange={(e) => setVia(e.target.value)}>{VIAS.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Frequência</span>
          <select className="input-field" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        {freq === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Frequência (texto)</span>
          <input className="input-field" value={freqCustom} onChange={(e) => setFreqCustom(e.target.value)} placeholder="Ex.: às segundas e quintas" /></label>}
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Duração</span>
          <select className="input-field" value={dur} onChange={(e) => setDur(e.target.value)}>{DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
        {dur === "custom" && <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Duração (texto)</span>
          <input className="input-field" value={durCustom} onChange={(e) => setDurCustom(e.target.value)} placeholder="Ex.: por 5 dias" /></label>}
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Quantidade total{suggestedQty != null && !qtyEdited ? " (sugerida)" : ""}</span>
          <input className="input-field" inputMode="numeric" value={effectiveQty} onChange={(e) => { setQty(e.target.value); setQtyEdited(true); }} placeholder="Editável" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">Orientações (opcional)</span>
          <input className="input-field" value={orient} onChange={(e) => setOrient(e.target.value)} placeholder="Ex.: tomar após as refeições" /></label>
      </div>
      <button type="button" className="btn-gold mt-3 text-sm" onClick={add}>Adicionar à receita</button>
    </div>
  );
}
