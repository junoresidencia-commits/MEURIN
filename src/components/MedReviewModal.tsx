"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { composerHref } from "@/lib/complementary-docs";
import { formatMedLine, medsToReceitaBody, type ParsedMed } from "@/lib/med-parser";

type Row = ParsedMed & { checked: boolean; text: string };

/**
 * Confirma medicamentos reconhecidos na evolução. Salva em "medicamentos em uso"
 * e/ou abre a receita já preenchida. O médico revisa tudo antes.
 */
export function MedReviewModal({
  emailParam,
  detected,
  existingText,
  onClose,
  onSavedMeds,
}: {
  emailParam: string;
  detected: ParsedMed[];
  existingText?: string;
  onClose: () => void;
  onSavedMeds?: (text: string) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    detected.map((d) => ({ ...d, checked: true, text: formatMedLine(d) }))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  const selected = rows.filter((r) => r.checked && r.text.trim());

  async function saveToProfile() {
    if (!selected.length) {
      setErr("Selecione ao menos um medicamento.");
      return false;
    }
    setSaving(true);
    setErr("");
    try {
      const incoming = selected.map((r) => r.text.trim());
      const prev = (existingText || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const line of [...incoming, ...prev]) {
        const k = line.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(line);
      }
      const text = merged.join("\n");
      const cur = await fetch(`/api/doctor/patients/${emailParam}/profile`).then((r) => r.json()).catch(() => ({}));
      const data = { ...(cur.profile || {}), medicamentos_em_uso: text };
      const res = await fetch(`/api/doctor/patients/${emailParam}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, baseUpdatedAt: cur.updatedAt || null }),
      });
      if (res.status === 409) {
        setErr("O perfil foi alterado em outro dispositivo. Atualize a página e tente de novo.");
        return false;
      }
      if (!res.ok) throw new Error();
      onSavedMeds?.(text);
      return true;
    } catch {
      setErr("Não foi possível salvar nos medicamentos em uso.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openReceita() {
    if (!selected.length) {
      setErr("Selecione ao menos um medicamento.");
      return;
    }
    const body = medsToReceitaBody(selected.map((r) => ({ ...r, name: r.text.split("—")[0].trim() || r.name, raw: r.text })));
    router.push(composerHref(emailParam, { type: "receita", title: "Receita médica", body }));
  }

  async function saveAndOpenReceita() {
    const ok = await saveToProfile();
    if (ok) openReceita();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-[var(--shadow)] sm:rounded-[24px] sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-display text-lg font-extrabold text-[var(--text)]">Medicamentos encontrados</p>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-[var(--text-muted)]">×</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-soft)]">
          Confira o que a evolução mencionou. Pode salvar nos medicamentos em uso e já abrir a receita preenchida.
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <label key={i} className={`flex items-start gap-2 rounded-2xl border p-3 ${r.checked ? "border-[var(--border-gold)] bg-[var(--gold-soft)]/40" : "border-[var(--border)]"}`}>
              <input type="checkbox" className="mt-2 h-5 w-5 accent-[var(--gold)]" checked={r.checked} onChange={(e) => patch(i, { checked: e.target.checked })} />
              <input className="input-field min-h-[44px]" value={r.text} onChange={(e) => patch(i, { text: e.target.value })} />
            </label>
          ))}
        </div>
        {err && <p className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{err}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>Agora não</button>
          <button type="button" className="btn-ghost flex-1" onClick={() => void saveToProfile()} disabled={saving || !selected.length}>
            {saving ? "Salvando…" : "Salvar em uso"}
          </button>
          <button type="button" className="btn-ghost flex-1" onClick={openReceita} disabled={!selected.length}>
            Abrir receita
          </button>
          <button type="button" className="btn-gold flex-1" onClick={() => void saveAndOpenReceita()} disabled={saving || !selected.length}>
            Salvar e abrir receita
          </button>
        </div>
      </div>
    </div>
  );
}
