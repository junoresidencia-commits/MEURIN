import { Suspense } from "react";
import { HdShell } from "@/components/hd/HdShell";

export default function HemodialiseLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="px-5 py-16 text-[var(--text-muted)]">Carregando Hemodiálise…</div>}>
      <HdShell>{children}</HdShell>
    </Suspense>
  );
}
