"use client";

import { useEffect, useState } from "react";
import { enablePush, notificationPermission, pushSupported } from "@/lib/push-client";

const DISMISS_KEY = "meurim_push_prompt_dismissed";

/** Modal discreto "Ativar lembretes". NÃO pede permissão automaticamente:
 *  só solicita a permissão nativa depois que o usuário toca em "Ativar notificações". */
export function EnableNotifications() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pushSupported()) return;
    const perm = notificationPermission();
    if (perm !== "default") return; // já concedeu ou negou → não insistir
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  async function ativar() {
    setBusy(true);
    setError("");
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setShow(false);
      return;
    }
    if (res.reason === "denied") {
      setError("As notificações foram bloqueadas. Você pode ativá-las nas configurações do navegador.");
    } else if (res.reason === "not_configured") {
      setError("As notificações ainda não estão configuradas no servidor.");
      setShow(false);
    } else if (res.reason === "unsupported") {
      setShow(false);
    } else {
      setError("Não foi possível ativar agora. Tente novamente mais tarde.");
    }
  }

  function agoraNao() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dark)] text-2xl">🔔</div>
        <h2 className="text-center font-display text-xl font-extrabold text-[var(--text)]">Ativar lembretes</h2>
        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          Receba avisos sobre suas consultas, alterações de horário e lembretes importantes. Sem dados sensíveis nas notificações.
        </p>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-600">{error}</p>}
        <div className="mt-5 grid gap-2">
          <button type="button" className="btn-gold w-full justify-center" onClick={ativar} disabled={busy}>
            {busy ? "Ativando…" : "Ativar notificações"}
          </button>
          <button type="button" className="btn-ghost w-full justify-center" onClick={agoraNao} disabled={busy}>
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
