"use client";

import { useState } from "react";

export function MarkPaidButton({
  bookingId,
  onDone,
  compact = false,
  endpoint = "/api/bookings",
  extraBody,
}: {
  bookingId: string;
  onDone?: () => void;
  compact?: boolean;
  endpoint?: string;
  extraBody?: Record<string, unknown>;
}) {
  const [saving, setSaving] = useState(false);

  async function mark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Marcar esta consulta como paga? Use quando o Pix, o dinheiro ou o cartão já entrou.")) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, action: "mark_paid", ...(extraBody || {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(d.error || "Não foi possível registrar o pagamento.");
        return;
      }
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={compact ? "btn-gold !px-2.5 !py-1 text-[11px]" : "btn-gold text-sm"}
      onClick={mark}
      disabled={saving}
    >
      {saving ? "Salvando…" : "Recebi o pagamento"}
    </button>
  );
}
