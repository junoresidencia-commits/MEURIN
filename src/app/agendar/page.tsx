import { Suspense } from "react";
import AgendarClient from "./AgendarClient";

export default function AgendarPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-5 py-20 text-[var(--text-muted)]">
          Abrindo agendamento…
        </div>
      }
    >
      <AgendarClient />
    </Suspense>
  );
}
