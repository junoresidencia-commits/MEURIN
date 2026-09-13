"use client";

import Link from "next/link";

/** Botão de saída sempre visível no topo das áreas administrativas. */
export function AreaBackBar({
  href,
  label = "Voltar",
}: {
  href: string;
  label?: string;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-white px-5 py-3">
      <Link
        href={href}
        className="btn-gold inline-flex min-h-11 items-center justify-center px-4"
      >
        ← {label}
      </Link>
    </div>
  );
}
