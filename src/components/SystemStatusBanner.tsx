"use client";

import { useEffect, useState } from "react";

export function SystemStatusBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.message) setMessage(String(d.message));
      })
      .catch(() => {
        setMessage("Estamos com dificuldade temporária de conexão. Seus dados digitados não devem ser apagados — tente de novo em instantes.");
      });
  }, []);

  if (!message) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">
      {message}
    </div>
  );
}
