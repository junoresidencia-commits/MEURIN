"use client";

import { useEffect, useState } from "react";
import {
  builtinByType,
  fillTemplate,
  TEMPLATE_TYPE_LABEL,
  type DocTemplate,
  type TemplateType,
} from "@/lib/document-templates";

type Custom = { id: string; type: TemplateType; title: string; body: string };

/**
 * Seletor de modelos (biblioteca pronta + favoritos do médico) para acelerar
 * a consulta. "Aplicar" preenche o campo (editável); "Salvar atual" guarda o
 * texto atual como um modelo favorito reutilizável.
 */
export function TemplatePicker({
  type,
  currentText,
  onApply,
  patientName,
}: {
  type: TemplateType;
  currentText: string;
  onApply: (text: string) => void;
  patientName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<Custom[]>([]);
  const [busy, setBusy] = useState(false);
  const builtin = builtinByType(type);

  async function loadCustom() {
    try {
      const res = await fetch("/api/doctor/templates");
      if (res.ok) {
        const data = await res.json();
        setCustom((data.templates || []).filter((t: Custom) => t.type === type));
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadCustom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  function apply(t: DocTemplate | Custom) {
    onApply(fillTemplate(t.body, { paciente: patientName }));
    setOpen(false);
  }

  async function saveCurrent() {
    const title = window.prompt("Nome do modelo (ex.: Minha receita de HAS):", "");
    if (!title || !title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/doctor/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title.trim(), body: currentText }),
      });
      if (res.ok) await loadCustom();
      else window.alert("Não foi possível salvar o modelo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este modelo favorito?")) return;
    const res = await fetch("/api/doctor/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setCustom((c) => c.filter((t) => t.id !== id));
  }

  const total = builtin.length + custom.length;

  return (
    <div className="rounded-2xl border border-[var(--border-gold)] bg-[var(--gold-soft)]/50">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-bold text-[var(--gold)]"
        >
          {open ? "▾" : "▸"} Modelos de {TEMPLATE_TYPE_LABEL[type].toLowerCase()} ({total})
        </button>
        {currentText.trim() && (
          <button
            type="button"
            onClick={saveCurrent}
            disabled={busy}
            className="text-xs font-semibold text-[var(--gold)] underline"
          >
            {busy ? "Salvando…" : "★ Salvar atual como modelo"}
          </button>
        )}
      </div>

      {open && (
        <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-[var(--border-gold)] p-3">
          {custom.length > 0 && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Meus favoritos</p>
          )}
          {custom.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => apply(t)}
                className="flex-1 rounded-xl border border-[var(--border-gold)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--text)] transition hover:border-[var(--gold)]"
              >
                ★ {t.title}
              </button>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 px-1 text-lg text-[var(--danger)]"
                aria-label={`Excluir modelo ${t.title}`}
              >
                ×
              </button>
            </div>
          ))}

          <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Biblioteca</p>
          {builtin.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t)}
              className="block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--text-soft)] transition hover:border-[var(--gold)] hover:text-[var(--text)]"
            >
              {t.title}
            </button>
          ))}
          <p className="pt-1 text-[11px] text-[var(--text-muted)]">
            Ao aplicar, o texto vai para o campo e continua totalmente editável antes de gerar/salvar.
          </p>
        </div>
      )}
    </div>
  );
}
