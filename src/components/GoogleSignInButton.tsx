"use client";

import { useState } from "react";

// Botão "Continuar com Google" (visual do mockup). O login Google real exige
// credenciais OAuth (Client ID/Secret) configuradas no servidor. Enquanto não
// estiverem, o botão avisa que está em configuração — sem simular um login falso.
export function GoogleSignInButton() {
  const [msg, setMsg] = useState("");
  return (
    <div>
      <div className="my-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" /> ou <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <button
        type="button"
        onClick={() => setMsg("Login com Google em breve — em configuração. Use e-mail/senha ou CPF por enquanto.")}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--border-gold)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
        </svg>
        Continuar com Google
      </button>
      {msg && <p className="mt-2 text-center text-xs text-[var(--text-muted)]">{msg}</p>}
    </div>
  );
}
